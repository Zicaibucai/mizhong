import type { Locale } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n';
import type { ContactView } from '@/lib/content';
import { MailIcon, PhoneIcon, WhatsAppIcon } from '@/components/ui/icons';

type Tone = 'whatsapp' | 'email' | 'phone';

interface ActionItem {
  key: string;
  type: ContactView['type'];
  href: string;
  label: string;
  value: string;
  Icon: typeof MailIcon;
  external: boolean;
  tone: Tone;
}

const TONES: Record<Tone, string> = {
  whatsapp: 'bg-[#25D366] text-white hover:bg-[#1FAE55] focus-visible:outline-[#128C7E]',
  email: 'bg-navy-900 text-ivory-50 hover:bg-navy-800 focus-visible:outline-copper-500',
  phone: 'border border-navy-200 bg-white text-navy-900 hover:bg-navy-50 focus-visible:outline-copper-500',
};

function buildItems(t: ReturnType<typeof getDictionary>, contacts: ContactView[]): ActionItem[] {
  const find = (type: ContactView['type']) =>
    contacts.find((contact) => contact.type === type && contact.href);

  const items: ActionItem[] = [];

  const whatsapp = find('WHATSAPP');
  if (whatsapp?.href) {
    items.push({
      key: 'whatsapp',
      type: 'WHATSAPP',
      href: whatsapp.href,
      label: t.contact.whatsapp,
      value: whatsapp.value,
      Icon: WhatsAppIcon,
      external: true,
      tone: 'whatsapp',
    });
  }

  const email = find('EMAIL');
  if (email?.href) {
    items.push({
      key: 'email',
      type: 'EMAIL',
      href: email.href,
      label: t.contact.email,
      value: email.value,
      Icon: MailIcon,
      external: false,
      tone: 'email',
    });
  }

  const phone = find('PHONE');
  if (phone?.href) {
    items.push({
      key: 'phone',
      type: 'PHONE',
      href: phone.href,
      label: t.contact.phone,
      value: phone.value,
      Icon: PhoneIcon,
      external: false,
      tone: 'phone',
    });
  }

  return items;
}

function ContactLink({ item, variant }: { item: ActionItem; variant: 'desktop' | 'mobile' }) {
  const Icon = item.Icon;
  const classes =
    variant === 'desktop'
      ? `inline-flex h-11 items-center gap-2.5 rounded-full px-5 text-sm font-medium shadow-lg shadow-navy-900/10 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${TONES[item.tone]}`
      : `flex h-11 items-center justify-center gap-1.5 rounded-full text-[13px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${TONES[item.tone]}`;

  return (
    <a
      href={item.href}
      {...(item.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      aria-label={`${item.label}: ${item.value}`}
      className={classes}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{item.label}</span>
    </a>
  );
}

/**
 * 全局联系方式入口。
 * 数据来自后台「联系方式」配置：只有已启用且填写了链接的项才会渲染，
 * 在后台停用某项后，对应入口会自动消失。
 */
export function ContactActions({ locale, contacts }: { locale: Locale; contacts: ContactView[] }) {
  const t = getDictionary(locale);
  const items = buildItems(t, contacts);

  if (items.length === 0) return null;

  // 桌面端右侧固定 WhatsApp 与 Email；移动端底部栏包含电话
  const desktopItems = items.filter((item) => item.type !== 'PHONE');
  const gridCols = items.length >= 3 ? 'grid-cols-3' : items.length === 2 ? 'grid-cols-2' : 'grid-cols-1';

  return (
    <>
      {desktopItems.length > 0 ? (
        <div className="pointer-events-none fixed bottom-6 right-6 z-40 hidden lg:block">
          <ul className="pointer-events-auto flex flex-col items-end gap-2.5">
            {desktopItems.map((item) => (
              <li key={item.key}>
                <ContactLink item={item} variant="desktop" />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t border-navy-200 bg-ivory-50/95 backdrop-blur lg:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <nav aria-label={t.footer.contactTitle}>
          <ul className={`mx-auto grid max-w-7xl ${gridCols} gap-2 px-3 py-2`}>
            {items.map((item) => (
              <li key={item.key}>
                <ContactLink item={item} variant="mobile" />
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </>
  );
}
