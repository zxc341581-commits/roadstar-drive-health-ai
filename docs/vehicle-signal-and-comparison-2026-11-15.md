# 차량 신호 누락과 주행 비교

확인일 2026-11-15. 이전 조사와 데이터 출처는 [자료 조사](research-2026-11-15.md)에 있다.

| 출처 | 확인한 근거 | 적용 및 확인이 필요한 항목 |
| --- | --- | --- |
| [Android CarPropertyValue](https://developer.android.com/reference/android/car/hardware/CarPropertyValue), [Pleos 차속 FAQ](https://document.pleos.ai/en/docs/pleos-only/vehicle-app-developer-guide/vehicle-app-faq) | PERF_VEHICLE_SPEED는 m/s다. 값의 상태가 사용 가능일 때 읽을 수 있다. CarPropertyValue 타임스탬프는 차량 속성이 발생한 단조 시간축의 ns 단위다. | 현재 약 0.5초 폴링은 호스트의 관측 시각으로 차속 변화율을 계산한다. 속성 콜백 타임스탬프 기반 분석과 동결·캐시된 값 판별은 후속 AVD 검증 항목이며, P단은 선택 기어 신호다. |
| [Pleos 주행 제한](https://document.pleos.ai/docs/pleos-only/vehicle-app-developer-guide/driving-restriction-development-guide), [Pleos ADB 디버깅](https://document.pleos.ai/en/docs/pleos-only/vehicle-app-developer-guide/adb-command-reference-guide) | 제한은 CarUxRestrictions를 사용한다. 공식 ADB 안내는 에뮬레이터에서 쓸 수 없는 일부 실차 명령을 명시한다. | 출발 전 P단·정차로 시작하고 복귀 후 리포트를 여는 기존 흐름을 유지한다. AVD에서 지원하는 신호·제한 조작과 앱의 유지·복귀 동작을 검증해야 한다. |
| [공모전 제출 안내](https://appdevchallenge.auto-hmg.io/guide/submission), [일정](https://appdevchallenge.auto-hmg.io/guide/schedule) | 2026-11-15 1차 접수 마감. 접수양식·전원 동의서가 필수이며 영상·소스와 APK는 선택 가산점이다. | 기존 제출 ZIP과 MP4의 바이트를 보존했다. 앱이 새로 빌드된 뒤 제출 자료에 반영할 수 있다. |
| [FHWA 2024 VM-2](https://www.fhwa.dot.gov/policyinformation/statistics/2024/vm2.cfm) | 전체 연간 주행거리 캘리포니아 325,959백만 mi, 텍사스 308,461백만 mi. 도로 기능 종류와 도시·농촌 열을 제공한다. | 미국 실증 후보 지역의 차량 노출량 참고 자료다. 앱에서 개별 노선과 교통 상태는 운전자가 확인하며, 주 자료로 자동 판정하지 않는다. |
| [DOE AFDC 전기차 정비](https://afdc.energy.gov/vehicles/electric-maintenance), [Hyundai USA 정비 일정](https://www.hyundaiusa.com/us/en/maintenance-schedule), [AAA Your Driving Costs](https://exchange.aaa.com/automotive/aaas-your-driving-costs/) | DOE는 회생제동이 마찰 브레이크 마모를 줄이는 요인이라고 설명한다. Hyundai는 차량별 일정을 제시하고 AAA는 표준 가정을 사용한다. | HEV·EV의 차속으로 마찰제동량을 추정하지 않는다. USD 견적은 입력 범위만 합산하며 센트 단위로 계산한다. |
| [Hagino 회생제동 다이너모미터 연구](https://www.mdpi.com/2073-4433/15/1/75), [US20250052567A1](https://patents.google.com/patent/US20250052567A1/en) | 논문은 회생·마찰제동이 함께 동작하는 실험 조건을 다룬다. 공개특허는 타이어 마모 에너지 추정에 바퀴 속도와 차량 속도의 차이 등 별도 변수를 사용한다. | 마모량이나 수명 추정을 추가하지 않았다. 타이어 센서와 실측 라벨, 별도의 권리 검토가 남았다. |

## 처리와 검증

- 약 0.5초 폴링에서 일시 누락 후 2초 이내에 회복하면 첫 유효 샘플에 구간 경계를 붙인다. 정상 응답 간격이 1초를 넘더라도 2초 이내인 경우 구간 경계를 붙인다. 2초 초과 또는 권한 거절이면 현재 기록을 종료하고 이전 분석을 유지한다. 시간 기준은 프로토타입의 데이터 품질 정책이다.
- 누락 시간에 걸치는 차속 차분, 사다리꼴 거리, 급감속 지속시간을 계산하지 않는다. 그래프는 구간을 나눠 그리고, 보고서에는 제외한 시간을 표시한다.
- 비교 화면에는 분석 거리를 나란히 표시한다. 같은 기록, 신호 누락 기록, 거리 0인 기록은 변화율을 숨긴다. 조건이 비슷하다고 직접 확인한 별도 기록은 기준 빈도가 양수일 때 변화율을 표시한다. 개선 예제는 가상 기록이다.
- node --test tests/*.test.cjs 통과 14개. python3 tests/check-recorder.py로 Java 기록기를 컴파일해 가상 시계와 가짜 차량 API에서 P→D→P, 일시 누락, 제한시간 초과, 권한 거절, 종료를 검증했다.
- Android SDK와 릴리스 키를 확보하지 못해 새 APK 빌드·서명, Android 장치 설치·시작·종료, Pleos AVD 및 실차 P단·차속 연동은 미검증이다. 기존 영상에는 이 빌드 대기 변경이 포함되지 않는다.
