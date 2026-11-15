# 선택 기어 신호 검증

확인일 2026-11-15. [차속 측정 시각](vehicle-measurement-time-2026-11-15.md)과 [긴 기록 보관](long-trip-storage-2026-11-15.md)을 보완한다.

| 원자료 | 핵심 근거와 반영 범위 |
| --- | --- |
| [AAOS VehicleGear](https://developer.android.com/reference/android/car/VehicleGear), [AAOS 속성](https://developer.android.com/reference/android/car/VehiclePropertyIds), [Pleos 차속 FAQ](https://document.pleos.ai/en/docs/pleos-only/vehicle-app-developer-guide/vehicle-app-faq) | GEAR_SELECTION은 선택 기어이며 CURRENT_GEAR는 실제 변속기의 기어를 뜻한다. AAOS 차속은 m/s이며 기어와 별개로 부호를 갖는다. 차속은 CAR_SPEED, 선택 기어는 CAR_POWERTRAIN 읽기 권한을 확인한다. 후보에선 문서화된 P·R·N·D·전진단만 사용한다. |
| [Pleos 주행 제한 개발](https://document.pleos.ai/docs/pleos-only/vehicle-app-developer-guide/driving-restriction-development-guide), [공모전 제출](https://appdevchallenge.auto-hmg.io/guide/submission) | 플랫폼의 주행 중 UX 제한은 CarUxRestrictions를 사용한다. 1차 접수는 2026-11-15까지이며 실행 가능한 APK와 영상은 선택 개발 자료다. 후보의 플랫폼 UX 연동과 기기 권한 확인은 남아 있다. 제출용 APK·영상은 v0.2.0이다. |
| [Hyundai USA 차량별 정비](https://www.hyundaiusa.com/us/en/maintenance-schedule), [FHWA VM-2](https://www.fhwa.dot.gov/policyinformation/statistics/2024/vm2.cfm), [AAA 비용](https://exchange.aaa.com/automotive/aaas-your-driving-costs/), [DOE AFDC](https://afdc.energy.gov/vehicles/electric-maintenance), [EPA MOVES](https://www.epa.gov/moves) | 차량 정비 주기, 지역 도로 주행량, 평균 유지비와 배출은 각각 다른 지표다. 예산에는 직접 입력한 금액만 합산한다. |
| [회생제동 실험](https://www.mdpi.com/2073-4433/15/1/75), [마모 공개특허](https://patents.google.com/patent/US10486674B2/en) | 회생·마찰제동의 분리와 부품 마모 산정에는 별도 계측 또는 입력이 필요하다. 가상 차량 자료로 마모량·고장 확률·절감액을 산정하지 않는다. |

알 수 없는 기어 값은 출발 또는 주차 상태 판정에 쓰지 않는다. 차량 기록 중 P단인데 차속 절댓값이 0.3 m/s를 초과하면 일시적인 누락과 같은 방식으로 제외한다. 유효 표본이 돌아오면 끊긴 구간에 차속 보간을 하지 않는다. 0.3 m/s와 시간 제한은 시제품 기준이며 실제 기어·차속 갱신 지연은 Pleos 기기에서 확인해야 한다.

가상 차량 신호 시험에서 정상 P→D→P, 시작 시 알 수 없는 기어, 주행 중 알 수 없는 기어, 속도와 P단 충돌 후 정상 복귀를 확인했다. JavaScript 회귀 27개, 모의 빌드, 제출용과 개선용 ZIP 무결성 검사도 통과했다. 현재 환경에는 Android SDK·릴리스 키가 없어 새 APK와 시연 영상은 갱신하지 않았다. Android 설치·실행과 Pleos 에뮬레이터·실차 시험은 미검증이다.
