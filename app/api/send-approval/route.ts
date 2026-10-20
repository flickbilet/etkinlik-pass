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
      from: 'Flick Bilet <Flick Bilet <bilet@flickbilet.com>',
      to: [email],
      subject: '🎉 Etkinlik Kaydınız Onaylandı! - Flick Bilet',
      html: `
        <div style="font-family: Arial, sans-serif; background-color: #020617; color: #ffffff; padding: 32px; border-radius: 24px; max-width: 500px; margin: 0 auto; border: 1px solid rgba(255,255,255,0.1);">
          <h2 style="color: #3b82f6; margin-bottom: 16px;">Merhaba ${ad_soyad},</h2>
          <p style="font-size: 15px; color: #cbd5e1; line-height: 1.6;">
            Etkinlik için yapmış olduğun kayıt ve ödeme kontrol edildi, kaydın <strong>ONAYLANDI</strong>! 🎟️
          </p>
          <p style="font-size: 13px; color: #94a3b8; line-height: 1.5; margin-top: 12px;">
            Biletini görüntülemek ve giriş QR koduna erişmek için sitemizi ziyaret edebilirsin.
          </p>
          <div style="margin-top: 28px; text-align: center;">
            <a href="https://flickbilet.com" style="background-color: #2563eb; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 12px; font-weight: bold; display: inline-block; font-size: 14px;">
              Biletime Git
            </a>
          </div>
          <hr style="border: none; border-top: 1px solid #1e293b; margin-top: 32px; margin-bottom: 16px;" />
          <p style="font-size: 11px; color: #64748b; text-align: center;">Flick Bilet Yönetim Ekibi</p>
        </div>
      `,
    });

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
