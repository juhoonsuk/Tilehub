interface Env {
  MAIL_FROM_EMAIL?: string;
  MAIL_FROM_NAME?: string;
  MAILCHANNELS_ENDPOINT?: string;
}

type InquiryType = "project" | "custom";

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
  project: "project@tilehub.kr",
  custom: "factory@tilehub.kr",
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

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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

  if (payload.inquiryType !== "project" && payload.inquiryType !== "custom") {
    return "잘못된 문의 유형입니다.";
  }

  if (!companyName || !managerName || !phone || !email) {
    return "필수 항목이 누락되었습니다.";
  }

  if (!isValidEmail(email)) {
    return "이메일 형식을 확인해 주세요.";
  }

  if (!isValidPhone(phone)) {
    return "연락처 형식을 확인해 주세요.";
  }

  if (payload.inquiryType === "project") {
    const requiredKeys = ["project_name", "site_location", "product_group", "sizes", "quantity", "delivery_schedule", "budget_range", "request_note"];
    if (requiredKeys.some((key) => !normalizeValue(payload[key]))) {
      return "프로젝트 견적 요청 필수 항목을 확인해 주세요.";
    }
  }

  if (payload.inquiryType === "custom") {
    const requiredKeys = ["request_product_type", "desired_size", "desired_color", "quantity", "sample_production", "preferred_delivery", "custom_note"];
    if (requiredKeys.some((key) => !normalizeValue(payload[key]))) {
      return "커스텀 제작 요청 필수 항목을 확인해 주세요.";
    }
  }

  return null;
}

function buildSubject(payload: InquiryPayload) {
  const companyName = normalizeValue(payload.company_name) || "미기재";

  if (payload.inquiryType === "project") {
    const projectName = normalizeValue(payload.project_name) || "프로젝트명 미기재";
    return `[TileHub 프로젝트 견적요청] ${companyName} - ${projectName}`;
  }

  const requestProductType = normalizeValue(payload.request_product_type) || "요청 제품 유형 미기재";
  return `[TileHub 커스텀 제작요청] ${companyName} - ${requestProductType}`;
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
  const title = payload.inquiryType === "project" ? "프로젝트 견적 요청" : "커스텀 타일 제작 요청";
  const rows = buildRows(payload);
  return [`${title}이 접수되었습니다.`, "", ...rows.map((row) => `${row.label}: ${row.value}`)].join("\n");
}

function buildHtmlBody(payload: InquiryPayload) {
  const title = payload.inquiryType === "project" ? "프로젝트 견적 요청" : "커스텀 타일 제작 요청";
  const rows = buildRows(payload)
    .map((row) => `<tr><td style="padding:10px 12px;border:1px solid #e9ebee;background:#f6f6f4;font-weight:700;">${escapeHtml(row.label)}</td><td style="padding:10px 12px;border:1px solid #e9ebee;">${escapeHtml(row.value)}</td></tr>`)
    .join("");

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111318;">
      <h2 style="margin:0 0 16px;">${escapeHtml(title)}</h2>
      <p style="margin:0 0 20px;color:#68707c;">TileHub 웹사이트를 통해 새로운 문의가 접수되었습니다.</p>
      <table style="width:100%;border-collapse:collapse;">${rows}</table>
    </div>
  `;
}

async function sendEmail(payload: InquiryPayload, env: Env) {
  const toEmail = EMAIL_MAP[payload.inquiryType];
  const fromEmail = env.MAIL_FROM_EMAIL || "no-reply@tilehub.kr";
  const fromName = env.MAIL_FROM_NAME || "TileHub Inquiry Bot";
  const endpoint = env.MAILCHANNELS_ENDPOINT || "https://api.mailchannels.net/tx/v1/send";
  const replyEmail = normalizeValue(payload.email);
  const replyName = normalizeValue(payload.manager_name) || fromName;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [
        {
          to: [{ email: toEmail }],
        },
      ],
      from: {
        email: fromEmail,
        name: fromName,
      },
      reply_to: {
        email: replyEmail,
        name: replyName,
      },
      subject: buildSubject(payload),
      content: [
        {
          type: "text/plain",
          value: buildTextBody(payload),
        },
        {
          type: "text/html",
          value: buildHtmlBody(payload),
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`메일 전송 실패: ${errorText}`);
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
    const message = error instanceof Error ? error.message : "전송에 실패했습니다. 잠시 후 다시 시도해 주세요.";
    return jsonResponse({ message }, 500);
  }
};
