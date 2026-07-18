/**
 * Схема конфига проекта и заготовка нового лендинга.
 *
 * Мультиязычное поле (тип ML): {"ru": "текст", "uz": "", "en": ""} — ru обязателен,
 * uz/en опциональны (на странице будет фолбэк на русский).
 *
 * Изображения хранятся в data/projects/<slug>/uploads/, в конфиге — имена файлов.
 */
'use strict';

const ml = (ru, uz, en) => ({ ru: ru || '', uz: uz || '', en: en || '' });

function newProject(slug, name) {
  return {
    slug,
    name: name || slug,
    brand: {
      mark: 'BC',                                  // до 3 букв в логотипе-плашке
      name: ml('Бизнес-центр'),
      tag: ml('Адрес · Город')
    },
    contacts: {
      phone: '+998 90 922 07 00',
      telegram: 'muhammadaxmadiy',
      email: 'caseadvisoryservicess@gmail.com',
      sheetsEndpoint: ''
    },
    seo: {
      title: ml('Название проекта — продажа и аренда помещений'),
      description: ml('Краткое описание проекта для поисковиков (1–2 предложения).'),
      keywords: '',
      domain: '',
      googleVerification: '',
      yandexVerification: ''
    },
    hero: {
      image: '',
      badges: [ml('Продажа и аренда')],
      title: ml('Помещения в новом проекте'),
      subtitle: ml('Короткий подзаголовок: локация, ключевые преимущества, формат.'),
      stats: []
    },
    uses: {
      enabled: true,
      h2: ml('Одно помещение — четыре сценария бизнеса'),
      sub: ml('Нежилой фонд со свободным назначением: вы сами выбираете, чем будет ваше пространство.'),
      note: ml(''),
      cards: [
        { icon: 'office', h: ml('Офис'), p: ml('Описание сценария использования.') },
        { icon: 'clinic', h: ml('Клиника'), p: ml('Описание сценария использования.') },
        { icon: 'service', h: ml('Сервис и услуги'), p: ml('Описание сценария использования.') },
        { icon: 'education', h: ml('Образование'), p: ml('Описание сценария использования.') }
      ]
    },
    lots: {
      h2: ml('Свободные помещения'),
      sub: ml('Краткое описание: сколько лотов доступно и что занято.'),
      items: [
        {
          title: ml('1 этаж — 100 м²'),
          area: ml('Помещение свободного назначения'),
          plan: '',
          features: [ml('Особенность помещения')]
        }
      ]
    },
    building: {
      enabled: true,
      h2: ml('О здании'),
      sub: ml('Краткое описание здания.'),
      specs: [
        { icon: 'building', b: ml('Этажность'), s: ml('уточните') },
        { icon: 'ceiling', b: ml('Потолки'), s: ml('уточните') },
        { icon: 'parking', b: ml('Паркинг'), s: ml('уточните') },
        { icon: 'grid', b: ml('Open Space'), s: ml('свободные планировки') }
      ],
      note: ml(''),
      images: []
    },
    invest: {
      enabled: false,
      h2: ml('Почему входить сейчас'),
      cards: [],
      strip: ml('')
    },
    progress: {
      enabled: false,
      h2: ml('Ход строительства'),
      sub: ml(''),
      image: '',
      steps: []
    },
    location: {
      h2: ml('Локация'),
      sub: ml('Описание района и окружения.'),
      address: ml('г. Ташкент, ул. …'),
      addressNote: ml('район · координаты'),
      city: 'Ташкент',
      lat: 41.311,
      lng: 69.28,
      pois: []
    },
    lead: {
      h2: ml('Получите планировки, цены и условия сделки'),
      sub: ml('Оставьте контакты — вышлем планы, актуальный прайс и ответим на вопросы.')
    },
    faq: [],
    footer: {
      addr: ml('г. Ташкент'),
      legal: ml('Информация на сайте носит справочный характер и не является публичной офертой. Визуализации — иллюстративные. © 2026')
    }
  };
}

module.exports = { newProject, ml };
