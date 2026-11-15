# 주행 기록 저장과 릴리스 검증

확인일 2026-11-15. 기존 [차량 신호 및 비교 검증](vehicle-signal-and-comparison-2026-11-15.md)과 [시장·마모 자료](research-2026-11-15.md)에 아래 내용을 추가한다.

| 출처 | 근거 | 적용과 남은 범위 |
| --- | --- | --- |
| [Android WebView 로컬 콘텐츠](https://developer.android.com/develop/ui/views/layout/webapps/load-local-content), [MDN localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage) | Android는 로컬 웹 자산에 WebViewAssetLoader를 사용할 수 있다고 안내한다. 일반 브라우저에서 file URL의 localStorage 동작은 정의되지 않았다. | 기존 WebView 주소와 저장 키를 유지하면서 기존 단일 주행 레코드를 읽는다. HTML을 직접 여는 브라우저의 저장 동작은 환경에 따라 달라질 수 있다. 실제 Android 재시작 검증이 필요하다. 추후 로컬 주소를 바꿀 경우 저장 원점 이전이 필요하다. |
| [Pleos 지역별 주행 제한](https://document.pleos.ai/en/docs/pleos-only/vehicle-app-planning-guide/driving-restiction-policy), [AAOS CarPropertyValue](https://developer.android.com/reference/android/car/hardware/CarPropertyValue) | Pleos 정책은 주행 상태와 지역별 제한에 따라 화면 이용을 제한한다. AAOS 차량 속성의 시간은 단조 시계의 ns 값이다. | 기존 차량 기록기의 관측 시간 및 P단 진입 검증을 다시 실행했다. 플랫폼 주행 제한 대응과 차속 m/s·기어·권한의 실제 동작은 Pleos AVD와 실차에서 확인해야 한다. |
| [현대차 공모전 지원·제출](https://appdevchallenge.auto-hmg.io/guide/submission) | 2026-11-15까지 접수하며, 서명 양식이 필수다. 선택 개발 자료로 영상과 실행 가능한 release APK를 포함한 소스를 제공할 수 있다. | 빌드 스크립트는 후보 버전을 0.2.1, versionCode 4로 지정한다. 서명 검증과 ZIP 정렬 검사가 끝난 임시 APK만 최종 경로로 옮긴다. 기존 v0.2.0 제출 파일을 보존했다. |
| [Hyundai USA 정비 프로그램](https://www.hyundaiusa.com/us/en/assurance/complimentary-maintenance), [AAA 유지비 방법론](https://exchange.aaa.com/automotive/aaas-your-driving-costs/) | 정비 프로그램의 적용 연식과 서비스 항목을 확인해야 한다. AAA 비용은 표준 조건의 추정치다. | 참가자가 입력한 견적만 더한다. 특정 차종에서 정비가 무료라고 자동 판정하거나 예상 절감액을 표시하지 않는다. |
| [NHTSA TireWise](https://www.nhtsa.gov/vehicle-safety/tires), [EPA MOVES](https://www.epa.gov/moves), [미국 타이어 마모 공개특허](https://patents.google.com/patent/US20250052567A1/en) | 타이어 점검에는 공기압과 트레드 상태 등 실제 확인 항목이 있다. EPA MOVES는 배출량을 모델링한다. 공개특허 예시는 차속·휠 속도 등 별도 신호를 사용한다. | 횡가속도 분석은 기록에 해당 신호가 있을 때만 표시한다. 입자 배출량, 트레드 잔량, 고장 확률로 변환하지 않는다. 외부 데이터 파일을 앱에 포함하지 않았다. |

## 검증

- 로컬 저장 형식은 동일 키에 버전 2로 저장된다. CSV와 차량 차속 각각 최신 분석 1개와 기준 요약을 보관하고 마지막으로 연 출처를 표시한다. 기존 단일 레코드는 변경 없이 읽고 다음 저장 때 형식을 바꾼다. 진행 중 원시 로그를 복구하는 기능은 없다.
- 비교 화면에 거리당 빈도와 원래 건수를 함께 표시한다. 기준이 0건인 경우 변화율을 계산할 수 없는 이유를 보여준다.
- JavaScript 회귀 16개, JVM 가상 기록기 확인, 모의 빌드 검증 실패 시 기존 APK 보존과 성공 시 교체, ZIP 무결성 검사를 통과했다. 모의 빌드 도구는 Android 도구나 실제 서명 검증을 대체하지 않는다.
- Android SDK Platform 35, Build Tools 및 릴리스 서명 환경이 확보되지 않아 새 APK를 생성하지 못했다. Android 시작·종료와 설치 업그레이드, Pleos AVD·실차 주행, 영상의 빌드 대기 기능은 미검증이다.
