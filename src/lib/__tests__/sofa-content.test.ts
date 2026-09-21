import assert from 'node:assert/strict';
import test from 'node:test';
import { locales } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { sofaContent } from '@/lib/i18n/sofa-content';
import { getPreviewCopy } from '@/lib/preview/content';

test('sofa homepage content is complete for every enabled locale', () => {
  for (const locale of locales) {
    const content = sofaContent[locale];
    const dictionary = getDictionary(locale);
    const preview = getPreviewCopy(locale);

    assert.ok(content.company.name.trim(), `${locale}: company name`);
    assert.ok(content.company.about.trim(), `${locale}: about`);
    assert.equal(dictionary.products.categories.length, 6, `${locale}: product categories`);
    assert.equal(preview.qualitySteps.length, 4, `${locale}: quality steps`);
    assert.ok(preview.requestCatalogue.trim(), `${locale}: empty-catalogue CTA`);
    assert.match(dictionary.meta.description.toLowerCase(), /sofa|沙发|sofá|ソファ|диван|أرائك|canapé|소파|सोफ़ा/);
  }
});

test('company fallback and every locale use the new-materials brand', () => {
  assert.equal(sofaContent.zh.company.name, '米众新材料有限公司');
  for (const locale of locales.filter((item) => item !== 'zh')) {
    assert.equal(sofaContent[locale].company.name, 'Mizhong New Materials Co., Ltd.');
  }
});
