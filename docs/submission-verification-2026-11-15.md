# 제출 파일과 개선 소스 확인

확인일 2026-11-15.

| 대상 | 확인 결과 |
| --- | --- |
| 제출용 v0.2.0 APK | ZIP 안의 앱 웹 자산과 소스가 바이트 단위로 일치한다. APK SHA-256은 497cf2a9a346727a4bee00873e229166713928be2df30ec1ab61119234e28c54이다. AOSP v2 서명과 콘텐츠 다이제스트를 다시 계산했으며 변조 사본은 검증에서 실패했다. |
| 제출용 v0.2.0 시연 영상 | H.264, 1280×720, 54초다. 전체 프레임 디코딩을 확인했다. 영상의 주행 신호는 가상이다. |
| v0.2.1 개선 소스 | 31개 JavaScript 회귀 테스트, 가상 Java 차량 기록, 모의 릴리스 스크립트와 ZIP 무결성 검사를 통과했다. 차속·기어 신호 누락 시 재수신 상태를 한 번 표시하고, 정상화되면 기록 상태로 돌아간다. 2초 초과 시 기록 중단과 이전 저장 기록 유지 경로를 확인했다. |

## 판단 근거

- [공모전 제출](https://appdevchallenge.auto-hmg.io/guide/submission)에서 2026-11-15까지 접수한다고 안내한다. 작성·서명한 접수양식은 필수이고 개발 파일은 선택이다. 저장소 공개가 어려운 경우 공식 공지에는 소스와 APK를 함께 담은 ZIP 내려받기 주소 방식도 안내돼 있다. 이 프로젝트의 저장소 업로드나 접수는 실행하지 않았다.
- [Pleos 차속 FAQ](https://document.pleos.ai/en/docs/pleos-only/vehicle-app-developer-guide/vehicle-app-faq), [AAOS CarPropertyValue](https://developer.android.com/reference/android/car/hardware/CarPropertyValue), [Pleos 주행 제한 개발](https://document.pleos.ai/docs/pleos-only/vehicle-app-developer-guide/driving-restriction-development-guide)에서 차속 m/s, 선택 기어 및 차속 읽기 권한, 단조 시간축의 ns, CarUxRestrictions 확인 경로를 확인했다. 이번 후보 변경은 기록 상태 안내에 한한다. 플랫폼 제한에 대한 실제 동작 확인은 남았다.
- [Hyundai USA 정비 일정](https://www.hyundaiusa.com/us/en/maintenance-schedule), [FHWA 도로 주행량 VM-2](https://www.fhwa.dot.gov/policyinformation/statistics/2024/vm2.cfm), [AAA 비용 방법론](https://exchange.aaa.com/automotive/aaas-your-driving-costs/), [DOE AFDC 전동차 정비](https://afdc.energy.gov/vehicles/electric-maintenance), [EPA MOVES](https://www.epa.gov/moves), [회생제동 시험](https://www.mdpi.com/2073-4433/15/1/75), [브레이크 마모 공개특허](https://patents.google.com/patent/US10486674B2/en)를 참고했다. 지역 주행량·표준 비용·브레이크 실험은 배경과 검증 범위를 정하는 데 사용했다. 원자료를 앱에 포함하지 않았고 입력 견적이나 운전 이벤트를 실제 마모량·절감액으로 변환하지 않는다.
- [Android APK v2 규격](https://source.android.com/docs/security/features/apksigning/v2)에 따라 기존 APK를 정적으로 검증했다. Android SDK와 서명 환경 부재로 v0.2.1 APK 빌드를 완료하지 못했다. 실제 Android 설치·시작·종료, Pleos 에뮬레이터 및 실차 신호와 탐지 정확도는 미검증이다.
