# 차속 표본 이상치와 급감속 경계 검증

확인일 2026-11-15.

| 원자료 | 적용과 한계 |
| --- | --- |
| [AAOS CarPropertyValue](https://developer.android.com/reference/android/car/hardware/CarPropertyValue), [AAOS 속성](https://developer.android.com/reference/android/car/VehiclePropertyIds), [Pleos 차속 FAQ](https://document.pleos.ai/en/docs/pleos-only/vehicle-app-developer-guide/vehicle-app-faq) | 차속 m/s와 측정 시각 ns로 종가속도를 계산한다. GEAR_SELECTION은 선택 위치이며 권한은 CAR_POWERTRAIN, 차속은 CAR_SPEED를 확인한다. 시제품의 종가속도 절댓값 상한 30 m/s²는 CSV 입력의 기존 검증 상한을 차속 입력에도 적용한 값이다. 실차의 표준 기준이나 성능 보장값이 아니다. |
| [Pleos 주행 제한](https://document.pleos.ai/docs/pleos-only/vehicle-app-developer-guide/driving-restriction-development-guide), [공모전 제출](https://appdevchallenge.auto-hmg.io/guide/submission) | 플랫폼 주행 제한은 CarUxRestrictions로 확인한다. 공식 안내의 1차 접수일은 2026-11-15까지다. 소스·실행 가능한 APK와 영상은 선택 개발 자료다. v0.2.0 제출 APK와 영상은 보존했다. 플랫폼 제한과 기기 실행은 미검증이다. |
| [NHTSA 자연주행 연구](https://rosap.ntl.bts.gov/view/dot/37370), [FHWA VM-2](https://www.fhwa.dot.gov/policyinformation/statistics/2024/vm2.cfm) | 자연주행 이벤트 연구와 지역 주행량은 별도 자료다. 이번 표본은 가상이며, 탐지 정밀도와 재현율의 자료로 사용할 수 없다. |
| [Hyundai USA 정비 일정](https://www.hyundaiusa.com/us/en/maintenance-schedule), [AAA 유지비](https://exchange.aaa.com/automotive/aaas-your-driving-costs/), [DOE AFDC](https://afdc.energy.gov/vehicles/electric-maintenance), [EPA MOVES](https://www.epa.gov/moves), [회생제동 실험](https://www.mdpi.com/2073-4433/15/1/75), [마모 추정 공개특허](https://patents.google.com/patent/US10486674B2/en) | 정비 일정과 비용은 차종과 입력 견적에 의존한다. 회생·마찰제동 기여와 부품 상태는 속도 차분으로 확인할 수 없다. 이번 변경으로 마모량, 고장확률, 절감액을 산정하지 않는다. |

차속 차분의 절댓값이 30 m/s²를 넘으면 해당 간격을 거리와 이벤트에서 제외한다. 예를 들어 가상 차속이 0.05초 동안 24 m/s에서 1 m/s로 바뀌면 계산상 -460 m/s²라서 제외한다. 같은 길이의 짧은 간격에서 정상적인 -2 m/s²는 그대로 쓴다. 저장했던 차속 기록의 이상값에도 같은 필터를 적용한다. 0.5초 지속시간과 1·2초 간격 경계에 소수 연산 오차 허용치를 적용했다. 계산 기준은 갱신하며 이전 요약에 대해서는 앱이 기준 재설정을 안내한다.

JavaScript 회귀 31개, 가상 Java 차량 기록기, 모의 빌드·ZIP 무결성을 통과했다. 기존 v0.2.0의 APK SHA-256, 소스 웹 자산 일치, v2 서명은 다시 확인했다. Android SDK와 릴리스 서명 환경이 없어 새 APK는 빌드하지 못했고 시연 영상도 갱신하지 않았다. 실제 Android 설치·구동, Pleos AVD·실차 신호와 정밀도는 미검증이다.
