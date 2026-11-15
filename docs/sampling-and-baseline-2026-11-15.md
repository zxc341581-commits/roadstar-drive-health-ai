# 표본 간격과 비교 기준

확인일 2026-11-15. [차속 시각과 데이터](speed-freshness-2026-11-15.md), [미국 시장·마모 자료](research-2026-11-15.md)를 보완한다.

| 원자료 | 확인한 근거 | 적용 및 한계 |
| --- | --- | --- |
| [Pleos 차량 차속 FAQ](https://document.pleos.ai/en/docs/pleos-only/vehicle-app-developer-guide/vehicle-app-faq), [AAOS 차량 속성](https://developer.android.com/reference/android/car/VehiclePropertyIds), [CarPropertyValue](https://developer.android.com/reference/android/car/hardware/CarPropertyValue) | Pleos는 AAOS의 PERF_VEHICLE_SPEED를 사용한다. 차속 m/s와 선택 기어는 다른 속성이며 각각 CAR_SPEED 및 CAR_POWERTRAIN 권한 문서를 따른다. 차량 속성 시각은 ns 단위다. | 표시 단위 km/h와 CSV 단위 m/s²를 유지한다. 간격 1초 초과는 데이터 품질을 위한 초기 가정이다. 실차 주기 및 이벤트 탐지 성능 확인이 필요하다. |
| [Pleos 주행 제한](https://document.pleos.ai/docs/pleos-only/vehicle-app-developer-guide/driving-restriction-development-guide), [공모전 제출 안내](https://appdevchallenge.auto-hmg.io/guide/submission) | 플랫폼은 CarUxRestrictions 상태에 대응하도록 안내한다. 1차 접수는 2026-11-15까지이고 서명 양식은 필수다. 영상과 소스·APK는 선택 개발 자료다. | 기존 제출 파일을 유지한다. 플랫폼 주행 제한 연동, AVD 및 기기 시작·종료 검증은 남았다. |
| [미 교통부 NGSIM 원자료와 스키마](https://data.transportation.gov/Automobiles/Next-Generation-Simulation-NGSIM-Vehicle-Trajector/8ect-6jqj/data) | 도로 영상으로 얻은 궤적은 0.1초 단위고 Global_Time은 밀리초다. 차량·촬영 시각을 묶고 자료의 속도·가속도 단위를 확인해야 한다. | 장차 인위적으로 표본을 줄여 비교하는 후보 데이터다. 앱에는 반입하지 않았다. 스키마 변환, 배포 조건, 영상 측정 오차와 제동 정답 라벨은 검증이 필요하며 앱의 정확도를 산정하지 않았다. |
| [FHWA VM-2](https://www.fhwa.dot.gov/policyinformation/statistics/2024/vm2.cfm), [Hyundai USA 차량별 정비](https://www.hyundaiusa.com/us/en/maintenance-schedule), [AAA 비용 방법론](https://exchange.aaa.com/automotive/aaas-your-driving-costs/) | FHWA는 주별·도로별 총 주행거리, Hyundai USA는 연식·모델별 정비일정, AAA는 표준 가정에 따른 비용을 제공한다. | 예산은 입력한 견적의 합이다. 정비 주기·비용을 개인 주행 빈도로 추정하지 않는다. |
| [DOE 전동차 정비](https://afdc.energy.gov/vehicles/electric-maintenance), [Hagino 회생 제동 실험](https://www.mdpi.com/2073-4433/15/1/75), [브레이크 패드 공개특허](https://patents.google.com/patent/US10486674B2/en) | 회생·마찰 제동 조합에 따라 마찰 브레이크의 기여가 달라진다. | 앱은 감속 이벤트를 보여준다. 가상·가져온 기록의 구분을 유지하고 실제 마모, 고장확률, 절감액을 계산하지 않는다. |

## 계산과 검증

- CSV와 차량 기록에서 1초를 초과하는 구간은 제외 시간으로 합산한다. 이 구간을 가로지르는 거리 보간 및 지속시간 연결을 하지 않으며 차속 그래프를 분리한다. CSV 파일 형식의 최대 허용 표본 간격은 기존 5초다. 1초 초과 구간이 있는 기록과 기준 사이에는 변화율을 제공하지 않는다.
- 표본을 수치로 해석하고 상대 시각·차속·가속도·누락 표시를 요약해 같은 주행의 재가져오기를 감지한다. 줄바꿈이나 숫자 표기만 바뀌어도 같은 분석 입력이면 비교를 막는다. 이 식별값은 파일 무결성 검증이나 주행 인증에 사용하지 않는다.
- 이전 계산 방식의 기준 요약은 읽을 수 있다. 새 방식의 빈도와 혼용하지 않도록 이전 기준의 수치를 숨기고 최신 기록을 기준으로 지정하는 안내를 표시한다.
- JavaScript 회귀 20개, 가상 Java 기록기, 모의 릴리스 스크립트, 후보 ZIP 무결성 검사를 통과했다. 새 Android 빌드는 ANDROID_SDK_ROOT 부재에서 중단됐다. 서명·신규 APK·영상 갱신, 실제 Android 화면과 Pleos AVD·실차 검증은 완료되지 않았다.
