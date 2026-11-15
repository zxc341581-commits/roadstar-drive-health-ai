# 차속 측정 시각과 분석 시간

확인일 2026-11-15.

| 원자료 | 확인 사항과 반영 범위 |
| --- | --- |
| [AAOS CarPropertyValue](https://developer.android.com/reference/android/car/hardware/CarPropertyValue), [AAOS 차량 속성](https://developer.android.com/reference/android/car/VehiclePropertyIds), [Pleos 차속 FAQ](https://document.pleos.ai/en/docs/pleos-only/vehicle-app-developer-guide/vehicle-app-faq) | 차속은 m/s, 속성 시각은 부팅 기준 단조 시계의 ns 단위다. 차속과 선택 기어에는 각각 CAR_SPEED, CAR_POWERTRAIN 읽기 권한을 확인한다. 후보의 차속 분석 입력은 최초 측정 시각을 0초로 변환한다. |
| [Pleos 주행 제한 개발](https://document.pleos.ai/docs/pleos-only/vehicle-app-developer-guide/driving-restriction-development-guide), [공모전 제출](https://appdevchallenge.auto-hmg.io/guide/submission) | 운전 중 제한은 CarUxRestrictions에서 확인한다. 1차 접수는 2026-11-15까지이며 영상과 소스·APK는 선택 자료다. 후보 수집기의 AAOS 상태·권한과 주행 화면 제한은 기기에서 검증해야 한다. |
| [FHWA VM-2](https://www.fhwa.dot.gov/policyinformation/statistics/2024/vm2.cfm), [현대 USA 차량 정비](https://www.hyundaiusa.com/us/en/maintenance-schedule), [AAA 유지비](https://exchange.aaa.com/automotive/aaas-your-driving-costs/) | 지역 주행량 및 정비·비용 방법론은 시장 배경이다. 견적 화면은 직접 입력한 금액만 합산한다. |
| [DOE AFDC](https://afdc.energy.gov/vehicles/electric-maintenance), [EPA MOVES](https://www.epa.gov/moves), [회생 제동 원 논문](https://www.mdpi.com/2073-4433/15/1/75), [마모 추정 공개특허](https://patents.google.com/patent/US10486674B2/en) | 회생제동, 배출 및 마모 추정에는 별도 측정이나 입력이 필요하다. 차속 표본 시각을 개선해도 부품 마모량·수명·비용 절감의 실증은 별도로 필요하다. |

- 새 차량 기록은 Android에서 속성 시각 B와 최초 시각 A의 차를 10억으로 나눠 초로 기록한다. 이를 거리 적분과 가속도 차분에 사용한다. 조회 시간은 통신 지연과 타임아웃 판단에 계속 사용한다. 표본 시각 간격이 2초를 넘으면 기록을 중단하고 최근 저장 결과를 보존한다.
- 조회 시각을 사용한 기존 차량 기록과 측정 시각을 사용한 새 차량 기록은 서로 비교하지 않는다. 양쪽은 계속 개별 열람할 수 있다. 리포트는 첫·마지막 표본 사이의 전체 시간과 누락 구간을 뺀 분석 가능 시간을 표시한다.
- 가상 Java 테스트로 조회와 속성 시각이 어긋나는 경우(0.4, 0.7, 1.35초), 2초 초과 표본 간격, P단 상태 전환·권한 거절·신호 누락·정리를 검증했다. JS 회귀 24개와 모의 빌드, ZIP 무결성 검사를 통과했다.
- 제출용 v0.2.0의 APK SHA-256, 자산 일치와 v2 무결성을 다시 확인했다. v0.2.1은 SDK와 릴리스 서명 환경이 없어 APK 빌드·서명 및 시연 갱신을 하지 않았다. Android 설치·구동 및 Pleos AVD·실차는 미검증이다.
