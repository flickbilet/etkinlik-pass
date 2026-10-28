"use client";
import { CheckCircle2, Download, CalendarDays, MapPin, ExternalLink } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { formatEventDateDisplay, unpackEventLocation } from '@/lib/dateUtils';

interface TicketViewProps {
  userDisplayName: string;
  selectedSeat: string | null;
  qrValue: string | null;
  indirPDF: () => void;
  selectedEvent?: any;
}

export default function TicketView({ userDisplayName, selectedSeat, qrValue, indirPDF, selectedEvent }: TicketViewProps) {
  const { locationName, locationUrl } = unpackEventLocation(selectedEvent);

  return (
    <div className="view-transition flex flex-col items-center">
      <div className="bg-emerald-500/10 text-emerald-400 px-4 py-2 rounded-full mb-6 flex items-center gap-2 text-xs font-black border border-emerald-500/20 uppercase">
        <CheckCircle2 size={14} /> Biletiniz Hazır
      </div>
      <h2 className="text-2xl font-black mb-1 text-center text-white uppercase">{userDisplayName}</h2>
      {selectedSeat ? (
        <p className="text-blue-400 font-bold mb-6 text-sm uppercase">KOLTUK: {selectedSeat}</p>
      ) : (
        <p className="text-blue-400 font-bold mb-6 text-sm uppercase">GENEL GİRİŞ</p>
      )}
      <div className="bg-white p-6 rounded-[2.5rem] shadow-2xl mb-6 relative z-20">
        <QRCodeCanvas id="ticket-qr" value={qrValue || ""} size={180} level="H" />
      </div>

      {selectedEvent && (
        <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 mb-6 text-center space-y-1.5">
          <p className="text-xs font-black text-white uppercase">{selectedEvent.event_name}</p>
          <p className="text-[10px] font-bold text-slate-400 uppercase flex items-center justify-center gap-1.5">
            <CalendarDays size={12} className="text-blue-400" />
            {formatEventDateDisplay(selectedEvent.event_date)}
          </p>
          <p className="text-[10px] font-bold text-slate-400 uppercase flex flex-wrap items-center justify-center gap-1.5">
            <MapPin size={12} className="text-blue-400" />
            <span>{locationName}</span>
            {locationUrl && (
              <a
                href={locationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-blue-400 hover:text-blue-300 underline underline-offset-2"
              >
                • Haritada Gör <ExternalLink size={11} />
              </a>
            )}
          </p>
        </div>
      )}

      <button onClick={indirPDF} className="w-full bg-emerald-600 text-white p-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all">
        <Download size={20} /> PDF OLARAK İNDİR
      </button>
    </div>
  );
}
