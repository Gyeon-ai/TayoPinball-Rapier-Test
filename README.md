# 타요 핀볼

## Rapier 공개 시험본

이 저장소는 기존 운영 사이트와 분리한 엔진 교체 시험본입니다. 화면 이름·이미지·색상·맵·타이머는 타요 버전을 유지합니다.

- 시험 사이트: https://gyeon-ai.github.io/TayoPinball-Rapier-Test/
- 같은 시험본에서 Box2D 비교: https://gyeon-ai.github.io/TayoPinball-Rapier-Test/?physics=box2d
- 기존 운영 사이트는 변경하지 않습니다: https://gyeon-ai.github.io/TayoPinball-Web/
- 기본 엔진은 Rapier 2D 0.20.0, 비교 엔진은 box2d-wasm 7.0.0입니다.
- 새 경기 시작은 1배속이며, 경기 중 1·2·5배속을 선택할 수 있습니다.
- 두 엔진 모두 60Hz 고정 스텝과 같은 시간 누적 로직을 씁니다. 과부하 시 무한 따라잡기를 막으므로 선택 배속보다 실제 진행이 느려질 수 있습니다.
- 공 충돌·튕김·당첨 결과가 원본과 완전히 같다는 보장은 없습니다. 2,000~3,000개·5배속 성능은 PC별 확인이 필요합니다.
- 시험 명단 저장 키는 운영본과 분리하며, 이 사이트는 서비스워커를 등록하거나 운영본 캐시를 삭제하지 않습니다.
- 수집기 기본 주소는 이번 시험에서 변경하지 않았습니다.

검증: `pnpm typecheck`, `pnpm test`, `pnpm build`. 로컬 정적 미리보기: `pnpm preview` (127.0.0.1:4178).
네온바·공 정렬 점검과 추가 개선 후보는 [ALIGNMENT_AUDIT.md](ALIGNMENT_AUDIT.md)에 기록했습니다. 현재 회귀 검사는 27개입니다.
주소에 `?perf=1` (Box2D는 `?physics=box2d&perf=1`)을 붙이면 개발자 도구의 `html[data-pinball-stats]`에 가시 탭 FPS·p95 프레임 간격·누적 처리 시간·초과 폐기 시간이 표시됩니다. 화면 UI는 추가하지 않습니다. 백그라운드 전환 시 물리 진행은 일시 중단하고 측정치를 초기화합니다. 결과 타이머는 기존 실제 시계 기준을 유지합니다.

배포 워크플로는 `Gyeon-ai/TayoPinball-Rapier-Test`에서만 실행됩니다. 운영 저장소로 이 시험 브랜치를 푸시하지 마세요.

아래는 원본 타요 기능 설명입니다. 수집기 연결과 기존 서비스워커 설명은 운영본에 관한 내용이며 시험본에는 위 분리 정책이 우선합니다.

구슬을 물리 엔진으로 굴려 당첨자를 뽑는 독립 실행형 웹 추첨기입니다. 원본
[Marble Roulette](https://github.com/lazygyu/roulette)를 기반으로 하며, 별도의 광고·분석 코드 없이 동작하도록 정리했습니다.

## 주요 기능

- 쉼표 또는 줄바꿈으로 참가자 입력
- `이름*3` 형식으로 같은 참가자의 구슬 수 지정
- `이름/3` 형식으로 구슬 무게 지정
- 여러 핀볼 맵과 첫 번째·마지막·지정 순위 당첨 방식
- 이름별로 고정 배정되는 타요 퍼스나콘 구슬 스킨
- 경기 중 즉시 적용되는 1x·2x·5x 배속과 중앙 누르기 임시 배속
- 당첨자 확정 후 직접 시작하는 카운트다운 타이머
- `?names=게임1,게임2` URL 매개변수로 명단 자동 입력
- 브라우저 로컬 저장 및 배포 시 최신 버전 자동 반영

기본 참가자는 `타요,종겜,핀볼`입니다.

## 실행과 빌드

Node.js 24와 pnpm 11.19.0을 권장합니다.

```powershell
pnpm install
pnpm dev
```

개발 서버는 기본적으로 `http://localhost:1235`에서 열립니다. 정적 배포 파일은 다음 명령으로 `dist` 폴더에 생성합니다.

```powershell
pnpm build
```

오프라인 실행은 지원하지 않습니다. 과거 버전의 서비스 워커가 남은 브라우저에서는 배포된 제거 스크립트가 타요 핀볼 캐시만 정리한 뒤 등록을 해제합니다.

## 수집기 연결

Windows 수집기의 `PinballUrl`에 `https://gyeon-ai.github.io/TayoPinball-Web/`를 설정하면 기존 `?names=` 명단 전달 기능을 사용할 수 있습니다.

## 이미지와 라이선스

핀볼 엔진은 [Marble Roulette](https://github.com/lazygyu/roulette)를 기반으로 하며 소스코드는 [MIT License](LICENSE)를 따릅니다. `Marble Roulette`와 `마블 룰렛` 명칭은 원본 프로젝트를 식별하기 위해서만 사용합니다.

타요 아이콘과 퍼스나콘은 MIT License 적용 대상이 아니며 각 이미지의 권리는 해당 권리자에게 있습니다. 제3자 구성요소와 이미지 사용 범위는 [NOTICE.md](NOTICE.md)를 확인하세요.
