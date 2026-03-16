interface Env {
  RESEND_API_KEY?: string;
  MAIL_FROM_EMAIL?: string;
  MAIL_FROM_NAME?: string;
  MAIL_TO?: string;
}

type InquiryType = "project" | "custom" | "sales" | "partners" | "inquiry";

type InquiryPayload = {
  inquiryType: InquiryType;
  company_name?: string;
  manager_name?: string;
  phone?: string;
  email?: string;
  project_name?: string;
  request_product_type?: string;
  [key: string]: unknown;
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const EMAIL_MAP: Record<InquiryType, string> = {
  project: "contact@tilehub.kr",
  custom: "contact@tilehub.kr",
  sales: "contact@tilehub.kr",
  partners: "contact@tilehub.kr",
  inquiry: "contact@tilehub.kr",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...CORS_HEADERS,
    },
  });
}

function normalizeValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean).join(", ");
  }

  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidPhone(value: string) {
  return value.replace(/\D/g, "").length >= 8;
}

function validatePayload(payload: InquiryPayload) {
  const companyName = normalizeValue(payload.company_name);
  const managerName = normalizeValue(payload.manager_name);
  const phone = normalizeValue(payload.phone);
  const email = normalizeValue(payload.email);
  const note = normalizeValue(payload.request_note || payload.custom_note || payload.note);

  if (!["project", "custom", "sales", "partners", "inquiry"].includes(payload.inquiryType)) {
    return "잘못된 문의 유형입니다.";
  }

  if (!companyName || !managerName || !phone || !email || !note) {
    return "필수 항목이 누락되었습니다.";
  }

  if (!isValidEmail(email)) {
    return "이메일 형식을 확인해 주세요.";
  }

  if (!isValidPhone(phone)) {
    return "연락처 형식을 확인해 주세요.";
  }

  return null;
}

function buildRows(payload: InquiryPayload) {
  const labels: Record<string, string> = {
    inquiryType: "문의 유형",
    company_name: "회사명 / 업체명",
    manager_name: "담당자명",
    job_title: "직함",
    phone: "연락처",
    email: "이메일",
    project_name: "프로젝트명",
    project_type: "프로젝트 유형",
    project_stage: "진행 단계",
    site_location: "현장 위치",
    order_timing: "예상 발주 시점",
    delivery_schedule: "희망 납기 일정",
    product_group: "요청 제품군",
    tile_type: "필요한 타일 종류",
    sizes: "희망 규격 / 사이즈",
    surface_style: "표면 / 스타일",
    color_tone: "컬러톤",
    quantity: "예상 수량",
    budget_range: "예산 범위",
    cert_docs: "필요 서류 / 인증 여부",
    packaging: "포장 조건",
    split_delivery: "현장 분할 납품 필요 여부",
    sample_needed: "샘플 필요 여부",
    allow_alternative: "대체 / 유사 제안 허용 여부",
    reference_link: "참고 제품 링크 또는 모델명",
    request_note: "요청사항 / 상세 내용",
    request_product_type: "요청 제품 유형",
    usage: "용도",
    application_area: "적용 부위",
    desired_size: "희망 사이즈",
    desired_thickness: "희망 두께",
    finish: "희망 마감",
    pattern_description: "희망 패턴 / 디자인 설명",
    desired_color: "희망 컬러 / 패턴",
    reference_product: "참고 이미지 또는 기존 제품명",
    pattern_repeat: "인쇄 / 패턴 반복 여부",
    edge_processing: "모서리 가공 / 특수 가공 필요 여부",
    sample_production: "샘플 필요 여부",
    repeat_order: "1회 / 반복 발주 여부",
    target_budget: "목표 단가 또는 예산 범위",
    preferred_delivery: "희망 납기",
    moq_check: "MOQ 협의 필요 여부",
    mold_dev: "금형 / 패턴 개발 확인 필요 여부",
    quality_note: "품질 기준 또는 검사 기준 메모",
    custom_note: "상세 요청사항",
  };

  return Object.entries(payload)
    .filter(([key]) => key !== "inquiryType")
    .map(([key, value]) => {
      const normalized = normalizeValue(value);
      if (!normalized) {
        return null;
      }

      return {
        label: labels[key] || key,
        value: normalized,
      };
    })
    .filter(Boolean) as Array<{ label: string; value: string }>;
}

function buildTextBody(payload: InquiryPayload) {
  const title = payload.inquiryType === "project"
    ? "프로젝트 견적 요청"
    : payload.inquiryType === "custom"
      ? "커스텀 타일 제작 요청"
      : payload.inquiryType === "partners"
        ? "제휴 / 협업 문의"
        : "일반 문의";
  const rows = buildRows(payload);
  return [`${title}이 접수되었습니다.`, "", ...rows.map((row) => `${row.label}: ${row.value}`)].join("\n");
}

async function sendEmail(payload: InquiryPayload, env: Env) {
  const toEmail = env.MAIL_TO || EMAIL_MAP[payload.inquiryType];
  const fromEmail = env.MAIL_FROM_EMAIL || "no-reply@tilehub.kr";
  const fromName = env.MAIL_FROM_NAME || "TileHub Inquiry Bot";
  const resendApiKey = normalizeValue(env.RESEND_API_KEY);
  const messageBody = buildTextBody(payload);
  const endpoint = "https://api.resend.com/emails";

  console.log("[inquiry] Email provider config", {
    provider: "resend",
    hasFromEmail: Boolean(fromEmail),
    hasFromName: Boolean(fromName),
    hasMailTo: Boolean(toEmail),
    hasResendApiKey: Boolean(resendApiKey),
  });

  if (!resendApiKey) {
    throw new Error("RESEND_API_KEY_MISSING");
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${fromName} <${fromEmail}>`,
      to: [toEmail],
      subject: "TileHub Inquiry",
      text: messageBody,
    }),
  });

  console.log("[inquiry] Provider response", {
    provider: "resend",
    status: response.status,
    ok: response.ok,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[inquiry] Provider send failed", {
      provider: "resend",
      status: response.status,
      bodyPreview: errorText.slice(0, 160),
    });

    if (response.status === 401 || response.status === 403) {
      throw new Error("RESEND_AUTH_ERROR");
    }

    throw new Error("RESEND_SEND_ERROR");
  }
}

export const onRequestOptions = async () =>
  new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const payload = (await request.json()) as InquiryPayload;
    const validationError = validatePayload(payload);

    if (validationError) {
      return jsonResponse({ message: validationError }, 400);
    }

    await sendEmail(payload, env);

    return jsonResponse({ ok: true, message: "문의가 정상적으로 접수되었습니다." });
  } catch (error) {
    console.error("[inquiry] Request failed", error);

    let message = "전송에 실패했습니다. 잠시 후 다시 시도해 주세요.";

    if (error instanceof SyntaxError) {
      message = "문의 데이터 형식이 올바르지 않습니다. 다시 시도해주세요.";
    } else if (error instanceof Error) {
      if (error.message === "RESEND_API_KEY_MISSING" || error.message === "RESEND_AUTH_ERROR") {
        message = "메일 전송 설정 문제로 접수가 완료되지 않았습니다. 잠시 후 다시 시도해주세요.";
      } else if (error.message === "RESEND_SEND_ERROR") {
        message = "메일 서버 연결 문제로 접수가 완료되지 않았습니다. 잠시 후 다시 시도해주세요.";
      } else {
        message = error.message || message;
      }
    }

    return jsonResponse({ message }, 500);
  }
};
