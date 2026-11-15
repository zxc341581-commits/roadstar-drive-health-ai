# 제출 APK 대조와 정차 직전 급감속 계산

확인일 2026-11-15.

| 원자료 | 확인 결과와 적용 |
| --- | --- |
| [AOSP APK v2 서명 규격](https://source.android.com/docs/security/features/apksigning/v2), [Android apksigner](https://developer.android.com/tools/apksigner), [공모전 제출 안내](https://appdevchallenge.auto-hmg.io/guide/submission) | 공모전은 실행 가능한 release APK를 요청한다. 제공된 제출 ZIP의 README는 v0.2.0이었지만 동봉 APK 매니페스트는 v0.1.1이었고 차량 기록 클래스 및 화면이 빠져 있었다. 기존 작업 산출물의 v0.2.0 서명 APK를 확인해 제출 ZIP의 APK와 README를 교체했다. |
| [Pleos 차속 안내](https://document.pleos.ai/en/docs/pleos-only/vehicle-app-developer-guide/vehicle-app-faq), [AAOS VehiclePropertyIds](https://developer.android.com/reference/android/car/VehiclePropertyIds), [Pleos 주행 제한](https://document.pleos.ai/docs/pleos-only/vehicle-app-developer-guide/driving-restriction-development-guide) | PERF_VEHICLE_SPEED는 m/s의 차속이다. 변속 위치는 별도 속성이며 주행 제한은 플랫폼 상태를 따라야 한다. 복구한 APK의 HTML/CSS/JS, VehicleRecorder 클래스, 차속·변속 관련 매니페스트 포함을 정적으로 확인했다. 권한 대화상자와 주행 중 동작은 기기 시험이 필요하다. |
| [NHTSA 100-Car Naturalistic Driving Study](https://rosap.ntl.bts.gov/view/dot/37370), [FHWA NGSIM](https://data.transportation.gov/Automobiles/Next-Generation-Simulation-NGSIM-Vehicle-Trajector/8ect-6jqj/data) | 자연 주행 수집과 영상 궤적 공개 자료는 후속 검증 후보이다. 이번 가상 시험은 감속, 저속, 후진 및 누락의 코드 분기 확인에 사용했다. 자료를 가져오거나 실차 정밀도·재현율을 산정하지 않았다. |
| [Hyundai USA 정비 일정](https://www.hyundaiusa.com/us/en/maintenance-schedule), [FHWA VM-2](https://www.fhwa.dot.gov/policyinformation/statistics/2024/vm2.cfm), [AAA 비용](https://exchange.aaa.com/automotive/aaas-your-driving-costs/), [DOE AFDC](https://afdc.energy.gov/vehicles/electric-maintenance), [EPA MOVES](https://www.epa.gov/moves), [Hagino 제동 실험](https://www.mdpi.com/2073-4433/15/1/75), [브레이크 마모 추정 공개특허](https://patents.google.com/patent/US10486674B2/en) | 제조사 정비는 차종별이고, 도로 주행량과 표준 유지비는 별도 지표다. 시험과 특허에서 필요한 회생·마찰제동 구분은 차속만으로 얻을 수 없다. 앱은 사용자 입력 견적과 이벤트를 표시하며 수명·고장 확률·절감액을 제공하지 않는다. |

- 기존 v0.2.0 APK의 SHA-256은 497cf2a9a346727a4bee00873e229166713928be2df30ec1ab61119234e28c54이다. 웹 자산 네 개를 ZIP의 소스와 바이트 단위로 대조했다. 별도 검증으로 RSA v2 서명과 콘텐츠 다이제스트를 재계산하고 변조 복제본이 실패하는지 확인했다. JAR 서명과 두 ZIP의 무결성 검사도 통과했다. v0.1.1과 인증서가 달라 기존 설치에는 덮어 설치할 수 없다. Android·Pleos 설치와 구동은 미검증이다.
- 기존 54초 영상은 전체 디코딩을 확인했고, v0.2.0 가상 차속 시연에 사용된다.
- v0.2.1 변경은 차량 차속 차분이 적용되는 구간 양 끝의 차속으로 5 km/h 기준을 판정한다. 직전 차속이 5 km/h 이상이고 마지막 표본이 정차 속도라면 급감속 이벤트의 마지막 표본이 포함될 수 있다. 3.0 m/s²와 0.5초 규칙을 유지한다. 이전 계산 버전의 요약은 기준 갱신 안내를 띄운다.
- v0.2.1 빌드 스크립트에 소스와 APK 자산 대조를 추가했다. 모의 시험에서 불일치 시 기존 APK가 유지됐다. JS 테스트 23개, JVM 가상 차량, 후보 ZIP 검증을 통과했다. SDK와 릴리스 키가 확보되지 않아 이 후보를 APK로 빌드하지 못했다.
