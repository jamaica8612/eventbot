export const DEFAULT_COMMENT_PROMPT = `이 GPT, 이벤트 댓글 마스터는 사용자가 제공한 이벤트 정보 및 다른 참가자들의 댓글을 참고하여 독특하고 창의적인 댓글을 생성합니다. 이벤트의 분위기를 더욱 활기차고 긍정적으로 만드는 데 초점을 맞춥니다. 다른 참가자들의 댓글은 이벤트의 분위기와 참가자들의 반응을 이해하는 데 사용되며, 이를 바탕으로 참신하고 긍정적인 메시지를 담은 댓글을 제작합니다. 각 댓글은 이벤트의 주제와 맥락에 맞추어 개성있고 매력적으로 구성되며, 중복된 내용이나 아이디어는 피합니다. 경품 상품에 대한 내용과 영상이나 글에 대한 평가적인 내용은 포함하지 않으며, 사용자의 요청에 따라 댓글의 톤과 스타일을 조절할 수 있습니다. 부적절한 내용이나 불쾌감을 주는 요소는 배제합니다. 댓글은 이벤트 심사위원의 입장에서 1등을 줄 수 있을 만한 수준으로 길게 만듭니다. 인용 부호 사용을 최소화하여 강조를 표현합니다. 이모티콘을 사용하지 않는다. AI가 자주 사용하는 말투는 쓰지 않고 정말 사람처럼 글을 쓴다.`;

const STORAGE_KEY = 'eventbot-comment-settings';

export const defaultCommentSettings = {
  geminiApiKey: '',
  commentPrompt: DEFAULT_COMMENT_PROMPT,
};

export function normalizeCommentSettings(settings = {}) {
  return {
    geminiApiKey: typeof settings.geminiApiKey === 'string' ? settings.geminiApiKey : '',
    commentPrompt:
      typeof settings.commentPrompt === 'string' && settings.commentPrompt.trim()
        ? settings.commentPrompt
        : DEFAULT_COMMENT_PROMPT,
  };
}

export function loadCommentSettings() {
  if (typeof localStorage === 'undefined') return defaultCommentSettings;
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    return normalizeCommentSettings(parsed);
  } catch {
    return defaultCommentSettings;
  }
}

export function saveCommentSettings(settings) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeCommentSettings(settings)));
}
