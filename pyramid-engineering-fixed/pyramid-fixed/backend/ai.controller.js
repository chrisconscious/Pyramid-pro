// src/modules/ai/ai.controller.js
// AI Chat Assistant — OpenAI if configured, smart keyword fallback otherwise

import { query, transaction } from './database.js';
import * as res from './response.js';
import { asyncHandler } from './helpers.js';
import logger from './logger.js';

// ---------------------------------------------------------------------------
//  Smart keyword-based response engine (works without OpenAI)
// ---------------------------------------------------------------------------
const RESPONSES = {
  en: {
    services: `We offer 4 core services:\n\n• Building Construction — residential, commercial & industrial\n• Architecture Planning & Design\n• Consultation & Feasibility Studies\n• Renovation & Maintenance\n\nWould you like details on any specific service?`,
    quote:    `To get a detailed quote:\n\n• Fill our Contact Form → /contact\n• Call/WhatsApp: 0757 744 555\n• Email: pyramid.constructor.ltd@gmail.com\n\nWe respond within 24 hours!`,
    contact:  `Contact Pyramid Engineering:\n\n📧 pyramid.constructor.ltd@gmail.com\n📞 0757 744 555\n💬 WhatsApp: wa.me/255757744555\n📍 Dar es Salaam, Tanzania\n\nOpen Mon–Sat, 8am–6pm`,
    projects: `We've completed 300+ projects across Tanzania:\n\n• Residential homes & luxury villas\n• Commercial plazas & office towers\n• Government buildings & infrastructure\n\nVisit our Projects page to view the full portfolio!`,
    about:    `Pyramid Engineering & Construction LTD has been building Tanzania's future since 2008.\n\n• 15+ years of experience\n• 300+ completed projects\n• 98% client satisfaction\n• Licensed & certified engineers`,
    default:  `Thank you for your message! For immediate assistance:\n\n📞 Call/WhatsApp: 0757 744 555\n📧 pyramid.constructor.ltd@gmail.com\n\nOur team is ready to help with your project!`,
  },
  sw: {
    services: `Tunatoa huduma 4 kuu:\n\n• Ujenzi wa Majengo\n• Mipango na Usanifu\n• Ushauri wa Mradi\n• Ukarabati na Matengenezo\n\nUnahitaji maelezo kuhusu huduma maalum?`,
    quote:    `Kupata bei ya kina:\n\n• Jaza fomu → /contact\n• Simu/WhatsApp: 0757 744 555\n• Barua pepe: pyramid.constructor.ltd@gmail.com`,
    contact:  `Wasiliana nasi:\n\n📧 pyramid.constructor.ltd@gmail.com\n📞 0757 744 555\n📍 Dar es Salaam, Tanzania`,
    projects: `Tumekamilisha miradi 300+ Tanzania:\n\n• Nyumba na villa\n• Majengo ya biashara\n• Majengo ya serikali`,
    about:    `Pyramid Engineering & Construction LTD wanajenga mustakabali wa Tanzania tangu 2008.\n\n• Miaka 15+ ya uzoefu\n• Miradi 300+ iliyokamilika`,
    default:  `Asante kwa ujumbe wako!\n\n📞 Simu/WhatsApp: 0757 744 555\n📧 pyramid.constructor.ltd@gmail.com`,
  },
  fr: {
    services: `Nous offrons 4 services:\n\n• Construction de Bâtiments\n• Planification & Conception\n• Consultation & Études\n• Rénovation & Maintenance`,
    quote:    `Pour un devis détaillé:\n\n• Formulaire → /contact\n• Appelez/WhatsApp: 0757 744 555\n• Email: pyramid.constructor.ltd@gmail.com`,
    contact:  `Contactez-nous:\n\n📧 pyramid.constructor.ltd@gmail.com\n📞 0757 744 555\n📍 Dar es Salaam, Tanzanie`,
    projects: `Nous avons complété 300+ projets en Tanzanie.`,
    about:    `Pyramid Engineering & Construction LTD — 15+ ans d'expérience en Tanzanie.`,
    default:  `Merci pour votre message!\n\n📞 Appelez/WhatsApp: 0757 744 555\n📧 pyramid.constructor.ltd@gmail.com`,
  },
};

function detectIntent(text) {
  const l = text.toLowerCase();
  if (/service|build|construct|architect|renovat|consult|huduma|ujenzi/i.test(l)) return 'services';
  if (/quote|price|cost|budget|bei|devis|thamani/i.test(l))                       return 'quote';
  if (/contact|call|email|phone|whatsapp|mahali|location/i.test(l))               return 'contact';
  if (/project|portfolio|work|miradi|travaux/i.test(l))                           return 'projects';
  if (/about|company|history|team|who|kuhusu/i.test(l))                           return 'about';
  return 'default';
}

// ---------------------------------------------------------------------------
//  OpenAI call (optional)
// ---------------------------------------------------------------------------
async function callOpenAI(messages, locale) {
  if (!process.env.OPENAI_API_KEY) return null;
  try {
    const { default: https } = await import('https');
    return new Promise((resolve, reject) => {
      const body = JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        max_tokens: 400,
        messages: [
          {
            role: 'system',
            content: `You are a helpful assistant for Pyramid Engineering & Construction LTD, a construction company in Dar es Salaam, Tanzania. Always respond in ${locale === 'sw' ? 'Swahili' : locale === 'fr' ? 'French' : 'English'}. Be concise, professional, and helpful. Company contact: 0757744555, pyramid.constructor.ltd@gmail.com`,
          },
          ...messages,
        ],
      });

      const req = https.request({
        hostname: 'api.openai.com',
        path:     '/v1/chat/completions',
        method:   'POST',
        headers:  {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Length': Buffer.byteLength(body),
        },
      }, (r) => {
        let data = '';
        r.on('data', chunk => data += chunk);
        r.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed.choices?.[0]?.message?.content || null);
          } catch { resolve(null); }
        });
      });
      req.on('error', () => resolve(null));
      req.write(body);
      req.end();
    });
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
//  POST /api/ai/chat
// ---------------------------------------------------------------------------
export const chat = asyncHandler(async (req, resp) => {
  const { message, session_key, locale = 'en' } = req.body;
  const startTime = Date.now();

  // Get or create conversation session
  let conversationId;
  const existing = await query(
    'SELECT id FROM ai_conversations WHERE session_key=$1', [session_key]
  );

  if (existing.rows.length) {
    conversationId = existing.rows[0].id;
  } else {
    const created = await query(
      'INSERT INTO ai_conversations (session_key, ip_address, user_agent, locale) VALUES ($1,$2,$3,$4) RETURNING id',
      [session_key, req.ip, req.get('user-agent'), locale]
    );
    conversationId = created.rows[0].id;
  }

  // Save user message
  await query(
    'INSERT INTO ai_messages (conversation_id, role, content, locale) VALUES ($1,$2,$3,$4)',
    [conversationId, 'user', message, locale]
  );

  // Build message history for context (last 8 messages)
  const history = await query(
    'SELECT role, content FROM ai_messages WHERE conversation_id=$1 ORDER BY created_at DESC LIMIT 8',
    [conversationId]
  );
  const historyMessages = history.rows.reverse().map(m => ({ role: m.role, content: m.content }));

  // Detect intent for keyword fallback
  const intent = detectIntent(message);

  // Try OpenAI first, fall back to keyword engine
  let aiResponse = await callOpenAI(historyMessages, locale);
  if (!aiResponse) {
    const langResponses = RESPONSES[locale] || RESPONSES.en;
    aiResponse = langResponses[intent] || langResponses.default;
  }

  const responseMs = Date.now() - startTime;

  // Save assistant message
  await query(
    `INSERT INTO ai_messages (conversation_id, role, content, detected_intent, locale, response_ms)
     VALUES ($1,'assistant',$2,$3,$4,$5)`,
    [conversationId, aiResponse, intent, locale, responseMs]
  );

  return res.success(resp, {
    response:     aiResponse,
    intent,
    session_key,
    conversation_id: conversationId,
  });
});

// ---------------------------------------------------------------------------
//  GET /api/ai/conversations  (admin — view chat history)
// ---------------------------------------------------------------------------
export const listConversations = asyncHandler(async (req, resp) => {
  const result = await query(
    `SELECT ac.*, COUNT(am.id) AS message_count
     FROM ai_conversations ac
     LEFT JOIN ai_messages am ON am.conversation_id = ac.id
     GROUP BY ac.id
     ORDER BY ac.created_at DESC
     LIMIT 50`
  );
  return res.success(resp, result.rows);
});

// ---------------------------------------------------------------------------
//  GET /api/ai/conversations/:id  (admin — view full conversation)
// ---------------------------------------------------------------------------
export const getConversation = asyncHandler(async (req, resp) => {
  const [convRes, msgRes] = await Promise.all([
    query('SELECT * FROM ai_conversations WHERE id=$1', [req.params.id]),
    query('SELECT * FROM ai_messages WHERE conversation_id=$1 ORDER BY created_at ASC', [req.params.id]),
  ]);
  if (!convRes.rows.length) return res.notFound(resp, 'Conversation');
  return res.success(resp, { conversation: convRes.rows[0], messages: msgRes.rows });
});
