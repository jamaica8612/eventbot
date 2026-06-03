// 텔레그램 봇 토큰/챗 ID가 제대로 설정됐는지 빠르게 확인하는 스크립트.
// 사용법: TELEGRAM_BOT_TOKEN=... TELEGRAM_CHAT_ID=... node scripts/sendTestTelegram.js
// (또는 .env / .env.local 에 값을 넣고 node scripts/sendTestTelegram.js)
import { canUseTelegram, sendTelegramMessage } from '../crawler/telegramNotifier.js';

if (!canUseTelegram()) {
  console.error(
    'TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID 가 설정되지 않았습니다. .env(.local) 또는 환경변수를 확인하세요.',
  );
  process.exit(1);
}

try {
  await sendTelegramMessage(
    ['✅ 이벤트봇 텔레그램 연결 테스트', '이 메시지가 보이면 알림 설정이 정상입니다.'].join('\n'),
  );
  console.log('테스트 메시지를 보냈습니다. 텔레그램을 확인하세요.');
} catch (error) {
  console.error(`발송 실패: ${error.message}`);
  process.exit(1);
}
