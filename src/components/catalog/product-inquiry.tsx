import type { Locale } from '@/lib/i18n';
import type { ProductDetailView } from '@/lib/catalog';
import type { ContactView } from '@/lib/content';
import { format, getCatalogDict } from '@/lib/i18n/catalog';
import { cn } from '@/lib/cn';
import { MailIcon, PhoneIcon, WhatsAppIcon } from '@/components/ui/icons';
import { absoluteProductUrl } from './urls';

/**
 * 产品页询盘入口。
 *
 * 只渲染后台「联系方式」中确实存在且已启用（带可用链接）的渠道；
 * 一个都没有时整个区块不渲染，绝不虚构联系方式。
 */

const actionBase =
  'inline-flex h-12 max-w-full items-center gap-2.5 border px-6 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2';

/** wa.me 链接在原有链接上追加预填文案（链接自带查询参数时也不会拼接错误） */
function withWhatsAppText(href: string, message: string): string {
  try {
    const url = new URL(href);
    url.searchParams.set('text', message);
    return url.toString();
  } catch {
    const separator = href.includes('?') ? '&' : '?';
    return `${href}${separator}text=${encodeURIComponent(message)}`;
  }
}

/** mailto 链接追加主题与正文 */
function withMailBody(href: string, subject: string, body: string): string {
  const separator = href.includes('?') ? '&' : '?';
  return `${href}${separator}subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function ProductInquiry({
  locale,
  product,
  contacts,
  className,
}: {
  locale: Locale;
  product: ProductDetailView;
  contacts: ContactView[];
  className?: string;
}) {
  const dict = getCatalogDict(locale);

  const whatsapp = contacts.find((contact) => contact.type === 'WHATSAPP' && contact.href);
  const email = contacts.find((contact) => contact.type === 'EMAIL' && contact.href);
  const phone = contacts.find((contact) => contact.type === 'PHONE' && contact.href);

  if (!whatsapp && !email && !phone) return null;

  const url = absoluteProductUrl(locale, product.slug);
  const message = format(dict.detail.whatsappMessage, { product: product.name, url });
  const subject = product.sku ? `${product.name} (${product.sku})` : product.name;

  return (
    <section className={cn('texture-weave-dark bg-navy-900 px-6 py-12 text-ivory-50 sm:px-12 lg:py-16', className)}>
      <div className="max-w-3xl">
        <p className="pv-mono text-[0.58rem] text-copper-300">DIRECT / INQUIRY</p>
        <h2 className="pv-display mt-5 text-3xl sm:text-5xl">
          {dict.detail.inquiryTitle}
        </h2>
        <p className="mt-4 text-base leading-relaxed text-navy-100">{dict.detail.inquirySubtitle}</p>

        <ul className="mt-8 flex flex-wrap gap-3">
          {whatsapp?.href ? (
            <li>
              {/* WhatsApp 绿 #25D366 很亮，配白字只有 1.98:1（远超常见的对比度失败）；
                  改配深色字反而有 9.77:1，同时保留品牌绿的可辨识度。 */}
              <a
                href={withWhatsAppText(whatsapp.href, message)}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(actionBase, 'border-[#25D366] bg-[#25D366] text-navy-950 hover:bg-[#1FAE55] focus-visible:outline-[#128C7E]')}
              >
                <WhatsAppIcon className="h-4 w-4 shrink-0" />
                {dict.detail.whatsapp}
              </a>
            </li>
          ) : null}

          {email?.href ? (
            <li>
              <a
                href={withMailBody(email.href, subject, message)}
                className={cn(actionBase, 'border-copper-700 bg-copper-700 text-ivory-50 hover:bg-copper-800 focus-visible:outline-copper-300')}
              >
                <MailIcon className="h-4 w-4 shrink-0" />
                {dict.detail.email}
              </a>
            </li>
          ) : null}

          {phone?.href ? (
            <li>
              <a
                href={phone.href}
                className={cn(actionBase, 'border border-ivory-50/40 text-ivory-50 hover:bg-ivory-50/10 focus-visible:outline-copper-300')}
              >
                <PhoneIcon className="h-4 w-4 shrink-0" />
                <span className="truncate">{phone.value}</span>
              </a>
            </li>
          ) : null}
        </ul>
      </div>
    </section>
  );
}
