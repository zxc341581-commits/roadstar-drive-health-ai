# 차속과 가져온 기록의 검증

확인일 2026-11-15. [차량 신호 누락](vehicle-signal-and-comparison-2026-11-15.md), [저장·릴리스](storage-and-release-2026-11-15.md), [시장과 마모 기준](research-2026-11-15.md)을 보완한다.

| 원자료 | 확인한 근거와 적용 |
| --- | --- |
| [Pleos 차속 FAQ](https://document.pleos.ai/en/docs/pleos-only/vehicle-app-developer-guide/vehicle-app-faq), [AAOS VehiclePropertyIds](https://developer.android.com/reference/android/car/VehiclePropertyIds), [CarPropertyValue](https://developer.android.com/reference/android/car/hardware/CarPropertyValue) | Pleos 차속은 PERF_VEHICLE_SPEED를 참조한다. AAOS 차속은 m/s이며 CAR_SPEED 읽기 권한이 필요하다. GEAR_SELECTION은 선택 기어이며 CAR_POWERTRAIN을 확인한다. CarPropertyValue 시간은 단조 시계의 ns이다. 같은 타임스탬프의 캐시 값을 새 표본으로 넣지 않는다. |
| [Pleos 주행 제한](https://document.pleos.ai/en/docs/pleos-only/vehicle-app-planning-guide/driving-restiction-policy), [제출 안내](https://appdevchallenge.auto-hmg.io/guide/submission) | 주행 제한은 지역 및 상태에 따라 달라진다. 제한 API 연동 시험은 남았다. 2026-11-15까지 1차 접수하며, 서명 양식은 필수이고 소스·APK·영상은 선택 가산점이다. |
| [FHWA 주별 주행거리 VM-2](https://www.fhwa.dot.gov/policyinformation/statistics/2024/vm2.cfm), [Hyundai USA 차량별 정비 일정](https://www.hyundaiusa.com/us/en/maintenance-schedule), [AAA Your Driving Costs](https://exchange.aaa.com/automotive/aaas-your-driving-costs/) | FHWA 도로 분류별 총 주행거리는 시장 규모 참고치다. 제조사 주기는 차량별로 확인하고, AAA 표준 비용은 개별 견적으로 사용하지 않는다. 외부 CSV를 포함하지 않았다. |
| [DOE AFDC 전동차 정비](https://afdc.energy.gov/vehicles/electric-maintenance), [Hagino 회생·마찰 제동 실험](https://www.mdpi.com/2073-4433/15/1/75), [브레이크 마모 추정 공개특허](https://patents.google.com/patent/US10486674B2/en) | 회생과 마찰 제동의 기여가 달라질 수 있다. 차속 이벤트에서 마모량, 잔여 수명, 고장확률 또는 비용을 산정하지 않는다. |

- 차속 속성 시각이 양수이고 관측 시점 기준 0~2초 이내인 경우만 받는다. 같은 속성 시각은 건너뛴다. 역순 값은 누락 취급하며, 표본 간 관측 또는 속성 시각 간격이 1초를 넘으면 누락 경계를 넣는다. 새 표본 없이 2초가 지나면 현재 기록을 종료하고 이전 저장 기록을 유지한다. 거리·가속도 계산에는 여전히 관측 간격을 사용한다.
- 두 시간 기준과 임계값은 시제품 정책이다. 차량마다 폴링 시각과 실제 속성 주기가 다를 수 있으므로 Pleos AVD에서 확인해야 한다. 선택 기어의 타임스탬프는 이 차속 정책으로 검사하지 않는다. 기어는 값이 바뀔 때 갱신되는 속성이므로 차속 신선도 한도를 그대로 적용하지 않는다.
- CSV에서 10진수와 지수 표기를 지원하고 16진수·2진수·비유한 값을 거절한다. CSV는 사용자가 가져온 자료로 표시하며, 가상 차속 재생과 내장 예제는 가상임을 표시한다.

JavaScript 17개, 가상 시계 기반 Java 기록기, 모의 릴리스 스크립트와 ZIP 무결성 검사를 통과했다. 가상 Java 환경에서는 복제 타임스탬프 건너뛰기, 연속 캐시 응답 종료, 시작 시 오래된 값과 미래 값 거절, P단 조건과 종료 시 예약 콜백 제거를 검증했다. Android SDK와 릴리스 키가 없어 새 APK 빌드·서명 및 영상 갱신을 보류했다. Android 기기 시작·종료와 Pleos AVD·실차 신호는 미검증이다.
