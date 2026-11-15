# 긴 운행 기록 보관

확인일 2026-11-15.

| 원자료 | 확인 및 적용 범위 |
| --- | --- |
| [WHATWG Web Storage](https://html.spec.whatwg.org/multipage/webstorage.html), [Android WebView 설정](https://developer.android.com/reference/android/webkit/WebSettings#setDomStorageEnabled(boolean)) | Web Storage 쓰기는 할당량을 초과하면 실패할 수 있다. Android WebView에서는 DOM 저장소를 활성화한다. v0.2.1은 CSV·차량 로그의 숫자 배열을 저장하고, 쓰기에 실패하면 이전 저장 데이터와 기준을 유지한다. 기기별 할당량은 검증이 필요하다. |
| [Pleos 차속 FAQ](https://document.pleos.ai/en/docs/pleos-only/vehicle-app-developer-guide/vehicle-app-faq), [AAOS 속성](https://developer.android.com/reference/android/car/VehiclePropertyIds), [Pleos 주행 제한](https://document.pleos.ai/docs/pleos-only/vehicle-app-developer-guide/driving-restriction-development-guide) | 차속은 m/s이며 선택 기어와 권한은 별도다. 주행 제한은 플랫폼 상태에 대응해야 한다. 저장과 복원에서 차량 측정 시각과 누락 표시를 보존한다. 실제 권한·P단·차속 동작 확인은 남았다. |
| [공모전 제출](https://appdevchallenge.auto-hmg.io/guide/submission) | 1차 접수는 2026-11-15까지이며 소스·APK·시연은 선택 개발 자료다. 제출 APK와 영상은 v0.2.0이다. |
| [Hyundai USA 정비](https://www.hyundaiusa.com/us/en/maintenance-schedule), [FHWA VM-2](https://www.fhwa.dot.gov/policyinformation/statistics/2024/vm2.cfm), [AAA 비용](https://exchange.aaa.com/automotive/aaas-your-driving-costs/), [DOE AFDC](https://afdc.energy.gov/vehicles/electric-maintenance), [EPA MOVES](https://www.epa.gov/moves), [회생제동 실험](https://www.mdpi.com/2073-4433/15/1/75), [마모 공개특허](https://patents.google.com/patent/US10486674B2/en) | 지역 주행량과 표준 비용, 제동 방식별 측정은 시장·검증 배경이다. 앱은 입력된 견적과 감속 이벤트를 표시한다. 마모량·고장 확률·비용 절감액은 산정하지 않는다. |

저장 형식 v3은 표본을 [시간, 차속, 종가속도, 횡가속도] 배열로 저장하고 누락 경계에는 다섯 번째 값을 추가한다. 차량 측정 기준 여부는 기록 단위로 저장한다. 기존 단일 형식과 v2도 읽으며, 다음 정상 저장 때 v3으로 쓴다. 손상된 기록 한쪽을 건너뛰어 다른 쪽을 복원할 수 있다. 저장 용량을 늘리는 설정이나 원시 위치는 추가하지 않았다.

0.5초 간격 14,000개의 가상 차속 표본과 예제 CSV를 35만 문자 모의 한도에서 저장·재실행했다. 이 한도는 회귀 시험용이며 Android나 Pleos의 보장값이 아니다. JavaScript 회귀 27개, 가상 차량 기록기, 모의 빌드·ZIP 무결성 검사를 통과했다. Android SDK가 없어 v0.2.1 APK 빌드가 중단됐고 실제 서명·설치·Pleos·실차 시험은 미검증이다.
