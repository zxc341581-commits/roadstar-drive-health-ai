# Drive Health AI

차량 주행 기록에서 브레이크·타이어에 부담을 줄 수 있는 이벤트를 찾아 운전습관 개선과 정비 예산 관리를 돕는 앱입니다.

## 릴리스 APK와 실행 방법

- 버전 **0.3.0** (versionCode 6), 패키지 `com.drivehealthai.demo`, Android 9(API 28) 이상.
- APK 위치는 [`apk/로드스타_DriveHealthAI_release.apk`](apk/로드스타_DriveHealthAI_release.apk)입니다. 로드스타 팀의 공모전 제출용 파일입니다.
- 설치 후 **Drive Health AI**를 실행합니다. 개발 환경에서는 `adb install apk/로드스타_DriveHealthAI_release.apk`로 설치를 시도할 수 있습니다. 이 릴리스는 v0.2.1과 같은 인증서를 사용합니다. v0.2.0과는 인증서가 달라 v0.2.0 위에 덮어 설치할 수 없습니다. 제거하면 기기에 저장된 기존 주행 기록과 견적이 삭제됩니다.
- [`app/src/main/assets/index.html`](app/src/main/assets/index.html)을 Chromium에서 열어 같은 웹 화면과 분석 엔진을 실행할 수 있습니다. 설치형 시제품에 API 키나 계정은 필요하지 않습니다.

## 시연 순서

1. **차량 기록 → 가상 차속 재생**에서 급감속 3건과 횡가속도 미수집 표시를 확인합니다.
2. **부품별 분석**에서 브레이크·타이어 코칭을 확인합니다. HEV·EV를 선택하면 회생제동 관련 안내가 표시됩니다.
3. **주행 리포트 → CSV 분석**에서 [기준 예제](demo/baseline.csv)를 불러옵니다. **습관 비교**에서 현재 기록을 기준으로 고정한 뒤, [개선 예제](demo/improved.csv)를 불러옵니다. 노선과 교통 조건 확인을 선택하면 100km당 빈도 변화율이 나옵니다. 두 파일은 시연용 가상 기록입니다.
4. **정비 예산**에서 주행습관과 연결된 부품 점검 안내를 확인한 뒤, 참고가를 가져오거나 견적을 직접 입력합니다. 예정 월을 다음 달로 정해 저장하면 월 예산에 반영됩니다.
5. 차량 신호를 제공하는 Android Automotive 환경에서는 정차한 P단에서 **차량 기록 시작**을 누르고 권한을 허용한 뒤 주행합니다. 주행 후 정차 상태로 P단에 복귀하면 리포트를 여는 흐름을 구현했습니다.

## 테스트 환경과 설정

| 항목 | 환경과 확인 범위 |
| --- | --- |
| 빌드 | Linux x86_64, OpenJDK 21, ECJ 3.38.0, Android SDK Platform 35와 Build Tools 35.0.0, 선택적 라이브러리 `android.car.jar` |
| APK 확인 | `apksigner verify`로 v3 릴리스 서명, `zipalign -c 4`로 정렬을 검증했습니다. 앱 ID, v0.3.0, 최소 API 28, 시작 Activity와 APK 안의 웹 파일 4개가 동봉 소스와 일치함을 확인했습니다. |
| 브라우저 시연 | v0.2.1의 웹 화면을 Chromium 131.0.6778.0, 뷰포트 1280×610, 시연 출력 1280×720. 가상 차속, 부품별 코칭, 두 CSV 비교와 조건 확인, 견적 추가·수정을 실행했습니다. |
| v0.3.0 확인 | JS 회귀 테스트 34개 통과. Chromium에서 1280×900과 390×844 화면으로 정비 예정 월, 참고가 저장, 견적 수정과 재실행 시 복원을 확인했습니다. |
| 자동 검사 이력 | v0.2.1에서 `node --test tests/*.test.cjs` 31개 통과. `python3 tests/check-recorder.py`로 가상 JVM 차량 신호 시험, `bash tests/check-build-publish.sh`로 모의 APK 교체 시험을 통과했습니다. |
| 개발에 사용한 Pleos Connect 에뮬레이터 | 사용하지 않았습니다. 개발에 사용한 Pleos 에뮬레이터의 버전·화면 실측값은 해당 사항이 없습니다. |
| Pleos 적용 대상 | 공식 Pleos Connect Emulator v2.1.0, Android Automotive API 34. [공식 설치 가이드](https://document.pleos.ai/docs/connect/guide/getting-started/application-development/setup-connect-sdk-emulator) |
| 실제 시연 화면 규격 | Chromium에서 앱 뷰포트 1280×610, 시연 영상 출력 1280×720(16:9). |

차량 기록은 AAOS `CarPropertyManager`의 `PERF_VEHICLE_SPEED`(m/s)와 `GEAR_SELECTION`을 사용합니다. v0.2.2는 Android 10 이상에서 차량 서비스가 연결 준비를 알린 뒤 신호 읽기를 시작합니다. 연결 대기 시간은 5초이며 서비스가 끊기면 기록을 종료하고 저장된 자료를 보존합니다. 차량에서 차속·선택 기어 읽기 권한과 속성 지원이 필요합니다. 일반 Android, Pleos 에뮬레이터·실차에서 이번 차량 연동의 실행 검증은 수행하지 않았습니다. 가상 차속과 CSV 분석은 이 권한 없이 사용할 수 있습니다. 시연 영상은 브라우저에서 녹화했으며 차량 신호는 가상 입력입니다. [Pleos 차량 차속 문서](https://document.pleos.ai/en/docs/pleos-only/vehicle-app-developer-guide/vehicle-app-faq)

## 계산과 보관

CSV 헤더는 `t_s,speed_kmh,long_ms2,lat_ms2`입니다. 시간은 초, 차속은 km/h, 가속도는 m/s²입니다. 이벤트의 100km당 빈도는 **이벤트 수 ÷ 분석 거리(km) × 100**으로 계산합니다. 급감속 기준은 차속 5 km/h 이상인 관측 구간에서 감속 크기 3.0 m/s² 이상이 0.5초 이상 지속되는 시제품 규칙입니다. 가속 기준은 3.0 m/s², 횡가속 기준은 절댓값 3.2 m/s²입니다. 누락 구간은 거리·이벤트에 포함하지 않습니다. 차량 차속만으로 분석할 때는 급코너링을 미수집으로 표시합니다.

CSV와 차량 기록은 각각 최근 분석과 비교 기준을 기기에 저장합니다. 다음 달 예산은 예정 월이 다음 달인 견적 범위의 합계입니다. 예정 월이 없는 기존 견적은 목록에 그대로 남습니다. 미국 참고가는 사용자가 선택해 저장할 때 예산에 들어갑니다. 브레이크는 패드 교체비 [RepairPal](https://repairpal.com/estimator/brake-pad-replacement-cost), 타이어는 16–20인치 사계절 타이어 4개 제품가 [Discount Tire](https://www.discounttire.com/blog/tire-prices-guide)를 사용합니다. 분석은 규칙 기반이며 부품 마모량·잔여수명·절감액을 산정하지 않습니다. `docs/`에는 후보 소스를 개발하던 당시의 연구 및 검증 기록이 들어 있습니다. 당시 문서에 적힌 APK 빌드 대기 상태는 이번 릴리스에서 해소했습니다.

## 다시 빌드하기

Android SDK Platform 35, Build Tools 35.0.0, Java 컴파일러, zip과 unzip을 준비합니다. 로컬 서명키를 마련하고 `ANDROID_SDK_ROOT`, `DRIVE_KEYSTORE`, `DRIVE_KEY_ALIAS`, `DRIVE_STORE_PASS`, `DRIVE_KEY_PASS`를 설정한 뒤 `bash scripts/build-release.sh 'apk/로드스타_DriveHealthAI_release.apk'`를 실행합니다. 필요한 경우 `BUILD_TOOLS_DIR`, `ANDROID_JAR`, `ANDROID_CAR_JAR`, `ECJ_JAR`로 설치 경로를 지정합니다. 서명키와 비밀번호는 저장소에서 제외합니다.
