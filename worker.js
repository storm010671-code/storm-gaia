export default {
  async fetch(request, env, ctx) {
    // CORS 허용 헤더 설정 (프론트엔드와 안전하게 통신하기 위함)
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers: corsHeaders });
    }

    try {
      const { prompt, model } = await request.json();

      // 여기서 여보가 숨겨둔 API 키를 안전하게 불러와서 사용합니다 (예: GEMINI_API_KEY 또는 GROK_API_KEY)
      const apiKey = env.GEMINI_API_KEY; 

      if (!apiKey) {
        return new Response(JSON.stringify({ error: "API Key is not configured in environment variables." }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // Gemini API 호출 예시 (안전한 서버 대 서버 통신)
      const apiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });

      const data = await apiResponse.json();
      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "가이아가 응답을 받아오지 못했어요, 하아...";

      return new Response(JSON.stringify({ reply }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  }
};
