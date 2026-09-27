import './localization';
import options from './options';
import { Box2dPhysics } from './physics-box2d';
import { RapierPhysics } from './physics-rapier';
import { Roulette } from './roulette';

// This trial has its own URL and never updates the production service worker.
const engine = new URLSearchParams(location.search).get('physics') === 'box2d' ? 'box2d' : 'rapier';
document.documentElement.dataset.physicsEngine = engine;
const roulette = new Roulette(engine === 'rapier' ? new RapierPhysics() : new Box2dPhysics());

(window as any).roulette = roulette;
(window as any).options = options;
