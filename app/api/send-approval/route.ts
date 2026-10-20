import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    const { email, ad_soyad } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'E-posta adresi bulunamadı.' }, { status: 400 });
    }

    const data = await resend.emails.send({
  from: 'Flick Bilet <ankaramedipolsinematiyatro@flickbilet.com>',
  to: [email],
  subject: 'Etkinlik Kaydınız Onaylandı - Flick Bilet',
  html: `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #020617; color: #ffffff; padding: 32px; border-radius: 16px; max-width: 500px; margin: 0 auto; border: 1px solid rgba(255,255,255,0.1);">
      <h2 style="color: #3b82f6; margin-bottom: 16px; font-size: 20px;">Merhaba ${ad_soyad},</h2>
      <p style="font-size: 15px; color: #cbd5e1; line-height: 1.6;">
        Ankara Medipol Sinema ve Tiyatro Topluluğu etkinliği için yapmış olduğunuz kayıt kontrol edilmiş olup kaydınız <strong>ONAYLANMIŞTIR</strong>.
      </p>
      <p style="font-size: 14px; color: #94a3b8; line-height: 1.5; margin-top: 16px;">
        Giriş QR kodunuza erişmek ve bilet detaylarınızı incelemek için sisteme giriş yapabilirsiniz.
      </p>
      <div style="margin-top: 28px; text-align: center;">
        <a href="https://www.flickbilet.com" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 10px; font-weight: 600; display: inline-block; font-size: 14px;">
          Bilet detaylarına git
        </a>
      </div>
      <hr style="border: none; border-top: 1px solid #1e293b; margin-top: 32px; margin-bottom: 16px;" />
      <p style="font-size: 11px; color: #64748b; text-align: center; line-height: 1.4;">
        Bu e-posta Flick Bilet üzerindeki etkinlik kaydınız nedeniyle otomatik olarak gönderilmiştir.<br />
        Ankara Medipol Üniversitesi Sinema ve Tiyatro Topluluğu
      </p>
    </div>
  `,
});

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
