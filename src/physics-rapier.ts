import RAPIER from '@dimforge/rapier2d-compat';
import type { StageDef } from './data/maps';
import type { IPhysics } from './IPhysics';
import type { MapEntity, MapEntityState } from './types/MapEntity.type';
import { interpolateAngle } from './utils/interpolateAngle';

type RapierEntity = {
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  state: MapEntityState;
  previousAngle: number;
};

let rapierInitialization: Promise<void> | null = null;

function initializeRapier(): Promise<void> {
  rapierInitialization ??= RAPIER.init();
  return rapierInitialization;
}

export class RapierPhysics implements IPhysics {
  private world!: RAPIER.World;
  private eventQueue!: RAPIER.EventQueue;
  private worldReady = false;
  private marbles = new Map<number, RAPIER.RigidBody>();
  private rotations = new Map<number, { raw: number; unwrapped: number }>();
  private entities: RapierEntity[] = [];
  private deleteCandidates: RAPIER.RigidBodyHandle[] = [];
  private lifeColliders = new Map<RAPIER.ColliderHandle, RAPIER.RigidBodyHandle>();

  async init(): Promise<void> {
    await initializeRapier();
    this.createWorld();
  }

  private createWorld(): void {
    this.world = new RAPIER.World({ x: 0, y: 10 });
    this.world.numSolverIterations = 4;
    this.world.maxCcdSubsteps = 1;
    this.eventQueue = new RAPIER.EventQueue(true);
    this.worldReady = true;
  }

  private releaseWorld(): void {
    if (!this.worldReady) return;
    this.eventQueue.free();
    this.world.free();
    this.worldReady = false;
  }

  private resetWorld(): void {
    this.marbles.clear();
    this.rotations.clear();
    this.entities = [];
    this.deleteCandidates = [];
    this.lifeColliders.clear();
    this.releaseWorld();
    this.createWorld();
  }

  private removeBodies(handles: RAPIER.RigidBodyHandle[]): void {
    for (const handle of handles) {
      const body = this.world.bodies.get(handle);
      if (body) this.world.removeRigidBody(body);
    }
  }

  clear(): void {
    if (this.marbles.size === 0) {
      this.resetWorld();
      return;
    }
    const handles = [...this.deleteCandidates, ...this.entities.map((entity) => entity.body.handle)];
    this.entities = [];
    this.deleteCandidates = [];
    this.lifeColliders.clear();
    this.removeBodies(handles);
  }

  clearMarbles(): void {
    // Do not mutate the body set while iterating a WASM callback.
    const handles = Array.from(this.marbles.values(), (body) => body.handle);
    this.marbles.clear();
    this.rotations.clear();
    this.removeBodies(handles);
  }

  createStage(stage: StageDef): void {
    this.createEntities(stage.entities);
  }

  private configureCollider(collider: RAPIER.ColliderDesc, entity: MapEntity): RAPIER.ColliderDesc {
    return collider
      .setDensity(entity.props.density)
      .setFriction(0.2)
      .setRestitution(entity.props.restitution)
      .setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Max);
  }

  private createEntities(entities?: MapEntity[]): void {
    if (!entities) return;

    for (const entity of entities) {
      const bodyDescription = (
        entity.type === 'kinematic' ? RAPIER.RigidBodyDesc.kinematicVelocityBased() : RAPIER.RigidBodyDesc.fixed()
      )
        .setTranslation(entity.position.x, entity.position.y)
        .setAngvel(entity.props.angularVelocity);
      const body = this.world.createRigidBody(bodyDescription);

      let colliderDescription: RAPIER.ColliderDesc;
      switch (entity.shape.type) {
        case 'box':
          colliderDescription = this.configureCollider(
            RAPIER.ColliderDesc.cuboid(entity.shape.width, entity.shape.height).setRotation(entity.shape.rotation),
            entity
          );
          break;
        case 'circle':
          colliderDescription = this.configureCollider(RAPIER.ColliderDesc.ball(entity.shape.radius), entity);
          break;
        case 'polyline': {
          // 기존 Box2D 구현은 polyline을 기본 restitution의 개별 edge fixture로 만든다.
          const vertices = new Float32Array(entity.shape.points.length * 2);
          entity.shape.points.forEach(([x, y], index) => {
            vertices[index * 2] = x;
            vertices[index * 2 + 1] = y;
          });
          colliderDescription = RAPIER.ColliderDesc.polyline(vertices)
            .setDensity(1)
            .setFriction(0.2)
            .setRestitution(0)
            .setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Max);
          break;
        }
      }

      const collider = this.world.createCollider(colliderDescription, body);
      if ((entity.props.life ?? -1) > 0) {
        collider.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
        this.lifeColliders.set(collider.handle, body.handle);
      }
      this.entities.push({
        body,
        collider,
        previousAngle: 0,
        state: {
          x: entity.position.x,
          y: entity.position.y,
          angle: 0,
          shape: entity.shape,
          life: entity.props.life ?? -1,
        },
      });
    }
  }

  createMarble(id: number, x: number, y: number): void {
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic().setTranslation(x, y).setCcdEnabled(true).setEnabled(false).setSleeping(true)
    );
    this.world.createCollider(
      RAPIER.ColliderDesc.ball(0.25)
        .setDensity(1 + Math.random())
        .setFriction(0.2)
        .setRestitution(0)
        .setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Max),
      body
    );
    this.marbles.set(id, body);
    this.rotations.set(id, { raw: 0, unwrapped: 0 });
  }

  shakeMarble(id: number): void {
    this.marbles.get(id)?.applyImpulse({ x: Math.random() * 10 - 5, y: Math.random() * 10 - 5 }, true);
  }

  removeMarble(id: number): void {
    const body = this.marbles.get(id);
    if (!body) return;
    this.marbles.delete(id);
    this.rotations.delete(id);
    this.world.removeRigidBody(body);
  }

  getMarblePosition(id: number): { x: number; y: number; angle: number } {
    const body = this.marbles.get(id);
    if (!body) return { x: 0, y: 0, angle: 0 };
    const position = body.translation();
    const rotation = this.rotations.get(id)!;
    const raw = body.rotation();
    // Rapier wraps at +/- PI; unwrap before the renderer interpolates the sprite.
    const delta = raw - rotation.raw;
    rotation.unwrapped += Math.atan2(Math.sin(delta), Math.cos(delta));
    rotation.raw = raw;
    return { x: position.x, y: position.y, angle: rotation.unwrapped };
  }

  getEntities(interpolation: number = 1): MapEntityState[] {
    return this.entities.map(({ body, state, previousAngle }) => ({
      ...state,
      angle: interpolateAngle(previousAngle, body.rotation(), interpolation),
    }));
  }

  impact(id: number): void {
    const source = this.marbles.get(id);
    if (!source) return;
    const sourcePosition = source.translation();

    for (const body of this.marbles.values()) {
      if (body === source) continue;
      const position = body.translation();
      const dx = position.x - sourcePosition.x;
      const dy = position.y - sourcePosition.y;
      const distanceSquared = dx * dx + dy * dy;
      if (distanceSquared <= 0 || distanceSquared >= 100) continue;

      const distance = Math.sqrt(distanceSquared);
      body.applyImpulse({ x: (dx / distance) * 4.05, y: (dy / distance) * 4.05 }, true);
    }
  }

  start(): void {
    for (const body of this.marbles.values()) {
      body.setEnabled(true);
      body.wakeUp();
    }
  }

  step(deltaSeconds: number): void {
    this.removeBodies(this.deleteCandidates);
    this.deleteCandidates = [];

    this.world.timestep = deltaSeconds;
    for (const entity of this.entities) entity.previousAngle = entity.body.rotation();
    this.world.step(this.eventQueue);

    const touchedBodies = new Set<RAPIER.RigidBodyHandle>();
    this.eventQueue.drainCollisionEvents((collider1, collider2, started) => {
      if (!started) return;
      const body1 = this.lifeColliders.get(collider1);
      const body2 = this.lifeColliders.get(collider2);
      if (body1 !== undefined) touchedBodies.add(body1);
      if (body2 !== undefined) touchedBodies.add(body2);
    });

    if (touchedBodies.size > 0) {
      this.entities = this.entities.filter((entity) => {
        if (!touchedBodies.has(entity.body.handle)) return true;
        this.lifeColliders.delete(entity.collider.handle);
        this.deleteCandidates.push(entity.body.handle);
        return false;
      });
    }
  }

  dispose(): void {
    if (!this.worldReady) return;
    this.marbles.clear();
    this.rotations.clear();
    this.entities = [];
    this.deleteCandidates = [];
    this.lifeColliders.clear();
    this.releaseWorld();
  }
}
