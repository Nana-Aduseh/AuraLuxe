import { MessageCircle } from "lucide-react";

interface WhatsAppButtonProps {
  message?: string;
}

const WHATSAPP_NUMBER = "233542426135";

export default function WhatsAppButton({
  message = "Hi AuraLuxe Extensions, I want to make an enquiry.",
}: WhatsAppButtonProps) {
  const href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with AuraLuxe Extensions on WhatsApp"
      className="no-print fixed bottom-6 right-6 z-50 inline-flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-3 text-white shadow-lg transition hover:scale-105 hover:bg-[#20bd5a]"
    >
      <svg viewBox="0 0 32 32" className="h-5 w-5 fill-current" aria-hidden="true">
        <path d="M19.11 17.21c-.27-.14-1.58-.78-1.83-.87-.24-.09-.42-.14-.6.14-.18.27-.69.86-.85 1.03-.16.18-.31.2-.58.07-.27-.14-1.13-.42-2.16-1.33-.8-.71-1.34-1.58-1.5-1.85-.16-.27-.02-.42.12-.56.12-.12.27-.31.4-.47.13-.16.18-.27.27-.45.09-.18.04-.34-.02-.47-.07-.14-.6-1.45-.82-1.99-.22-.52-.44-.45-.6-.46h-.51c-.18 0-.47.07-.72.34-.24.27-.94.92-.94 2.24s.96 2.6 1.09 2.78c.13.18 1.88 2.88 4.56 4.04.64.28 1.14.45 1.53.58.64.2 1.22.17 1.68.1.51-.08 1.58-.65 1.8-1.28.22-.63.22-1.17.16-1.28-.07-.11-.24-.18-.51-.31z" />
        <path d="M16 3C8.83 3 3 8.83 3 16c0 2.54.73 4.91 1.99 6.92L3 29l6.26-1.95A12.93 12.93 0 0 0 16 29c7.17 0 13-5.83 13-13S23.17 3 16 3zm0 23.64c-2.07 0-4.09-.55-5.86-1.58l-.42-.25-3.72 1.16 1.2-3.62-.27-.45A10.6 10.6 0 0 1 5.36 16C5.36 10.13 10.13 5.36 16 5.36S26.64 10.13 26.64 16 21.87 26.64 16 26.64z" />
      </svg>
      <span className="hidden sm:inline text-sm font-semibold">WhatsApp</span>
      <MessageCircle className="h-4 w-4 sm:hidden" aria-hidden="true" />
    </a>
  );
}
