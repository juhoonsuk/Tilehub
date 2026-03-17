const DISABLED_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function disabledResponse() {
  return new Response(
    JSON.stringify({
      ok: false,
      message: "이 문의 엔드포인트는 더 이상 사용되지 않습니다. 사이트 폼은 Formspree로 직접 전송됩니다.",
    }),
    {
      status: 410,
      headers: DISABLED_HEADERS,
    },
  );
}

export const onRequestOptions = async () => new Response(null, { status: 204, headers: DISABLED_HEADERS });

export const onRequestPost: PagesFunction = async () => disabledResponse();
