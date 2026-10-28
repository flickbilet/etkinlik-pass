import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';
import { IS_DATABASE_READ_ONLY } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    if (IS_DATABASE_READ_ONLY) {
      return NextResponse.json({
        success: true,
        readOnlyBlocked: true,
        message: 'Salt-okunur koruma modu aktif olduğu için gerçek e-posta gönderimi engellendi.',
      });
    }

    const resend = new Resend(process.env.RESEND_API_KEY || 're_placeholder');
    // Yetki kontrolü: Yalnızca oturum açmış admin kullanıcılar e-posta tetikleyebilir
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '').trim();

    if (!token) {
      return NextResponse.json({ error: 'Yetkisiz erişim (Token eksik).' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Geçersiz veya süresi dolmuş oturum.' }, { status: 401 });
    }

    // Yetki kontrolü: Yalnızca tanımlı admin e-postaları e-posta gönderimi tetikleyebilir
    const allowedEnv = process.env.NEXT_PUBLIC_ADMIN_EMAILS;
    if (allowedEnv && allowedEnv.trim()) {
      const allowedList = allowedEnv.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
      if (allowedList.length > 0 && !allowedList.includes(user.email?.toLowerCase() || '')) {
        return NextResponse.json({ error: 'Bu işlem için admin yetkisi gerekiyor.' }, { status: 403 });
      }
    }

    const { email, ad_soyad, event_name } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'E-posta adresi bulunamadı.' }, { status: 400 });
    }

    const eventTitle = event_name ? `<strong>${event_name}</strong> etkinliği` : 'etkinliği';

    const data = await resend.emails.send({
      from: 'Flick Bilet <ankaramedipolsinematiyatro@flickbilet.com>',
      to: [email],
      subject: 'Etkinlik Kaydınız Onaylandı - Flick Bilet',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #020617; color: #ffffff; padding: 32px; border-radius: 16px; max-width: 500px; margin: 0 auto; border: 1px solid rgba(255,255,255,0.1);">
          <h2 style="color: #3b82f6; margin-bottom: 16px; font-size: 20px;">Merhaba ${ad_soyad},</h2>
          <p style="font-size: 15px; color: #cbd5e1; line-height: 1.6;">
            Ankara Medipol Sinema ve Tiyatro Topluluğu ${eventTitle} için yapmış olduğunuz kayıt kontrol edilmiş olup kaydınız <strong>ONAYLANMIŞTIR</strong>.
          </p>
          <p style="font-size: 14px; color: #94a3b8; line-height: 1.5; margin-top: 16px;">
            Giriş QR kodunuza erişmek, koltuğunuzu seçmek ve bilet detaylarınızı incelemek için sisteme giriş yapabilirsiniz.
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
