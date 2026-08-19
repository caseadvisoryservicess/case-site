# Карта 301 со старых адресов

Старый сайт держал языки отдельными страницами и дублировал портфолио.
Каждый адрес ниже отдаёт 301 на новый. Готовые правила: `redirects/.htaccess`
(Apache, DirectAdmin) и `redirects/_redirects` (Netlify).

| Старый адрес | Новый адрес |
|---|---|
| `/main-ru` | `/ru/` |
| `/main-en` | `/en/` |
| `/portfolio-uz` | `/projects.html` |
| `/portfolio-ru` | `/ru/projects.html` |
| `/portfolio-en` | `/en/projects.html` |
| `/portfolio-uz2` | `/projects.html` |
| `/portfolio-ru2` | `/ru/projects.html` |
| `/portfolio-en2` | `/en/projects.html` |
| `/faq-uz` | `/#faq` |
| `/faq-ru` | `/ru/#faq` |
| `/faq-en` | `/en/#faq` |
| `/ijara` | `/leasing.html` |
| `/arenda` | `/ru/leasing.html` |
| `/leasing` | `/en/leasing.html` |
| `/82mall` | `/en/projects/82-mall.html` |
| `/82mall-ru` | `/ru/projects/82-mall.html` |
| `/82mall-uz` | `/projects/82-mall.html` |
| `/chilonzormall` | `/en/projects/chilonzor.html` |
| `/chilonzormall-ru` | `/ru/projects/chilonzor.html` |
| `/chilonzormall-uz` | `/projects/chilonzor.html` |
| `/form-ru` | `/ru/contact.html` |
| `/form-en` | `/en/contact.html` |
| `/form-uz` | `/contact.html` |
| `/ru` | `/ru/` |
| `/uz` | `/` |
| `/en` | `/en/` |

## Два домена: caseadvisory.com и caseadvisory.uz

Сейчас работают оба. Канонический один: `caseadvisory.com`. Поисковой системе и ИИ
нужен единственный адрес, иначе вес делится между копиями, а в ответы
попадает то одна версия, то другая.

Правило: весь сайтовый трафик с `caseadvisory.uz` и с `www` уходит 301 на `caseadvisory.com`.

**Важное исключение.** На `caseadvisory.uz` живёт внутренняя платформа CASE OS
в папке `/os/` (её заливает GitHub Actions) и админка в `/admin/`.
Эти пути редиректить нельзя: они не часть публичного сайта.
Правила в `redirects/.htaccess` их исключают. Почта на домене `.uz`
(`support@caseadvisory.uz`) редиректом не затрагивается вообще.
