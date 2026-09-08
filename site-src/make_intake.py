#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Сборка анкеты для клиента и списка вопросов для репозитория.

Один источник вопросов: content/intake.py. Отсюда получается два вида:
  * INTAKE.md в корне, чтобы вопросы жили в репозитории и читались без сети;
  * intake/case-intake.html, страница с автосохранением, которую публикуем
    как ссылку и заполняем в браузере.

Запуск: python3 site-src/make_intake.py
"""

import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(HERE, "content"))

import intake  # noqa: E402

STATUS_HINT = ("Ответьте в поле и поставьте состояние: «готово» значит можно "
               "публиковать, «пока нет» значит вернёмся позже, «не публикуем» "
               "значит блок убираем со страницы совсем. Третий вариант тоже "
               "ответ: он разблокирует запуск не хуже первого.")


def build_md():
    n = 0
    out = [
        "# Что нужно от CASE, чтобы запустить сайт",
        "",
        "Собрано автоматически: `python3 site-src/make_intake.py`.",
        "Источник вопросов один: `site-src/content/intake.py`.",
        "",
        "Живая версия с автосохранением публикуется отдельной ссылкой.",
        "Этот файл нужен, чтобы вопросы жили в репозитории и читались без сети.",
        "",
        STATUS_HINT,
        "",
    ]
    for wave in intake.WAVES:
        out += ["---", "",
                "## Волна %s. %s" % (wave["n"], wave["title"]),
                "", wave["why"], "", "*%s*" % wave["meta"], ""]
        for item in wave["items"]:
            n += 1
            out += ["### %02d. %s" % (n, item["t"]),
                    "",
                    "**Зачем.** " + item["why"],
                    "",
                    "**Где на сайте.** " + item["where"],
                    "",
                    "**Что написать.**",
                    "",
                    "```",
                    item["hint"],
                    "```",
                    "",
                    "**Ответ:**",
                    "",
                    "",
                    ]
    with open(os.path.join(ROOT, "INTAKE.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(out))
    return n


def build_html():
    tpl_path = os.path.join(HERE, "intake", "template.html")
    with open(tpl_path, encoding="utf-8") as f:
        tpl = f.read()
    data = json.dumps(intake.WAVES, ensure_ascii=False, indent=2)
    html = tpl.replace("__WAVES__", data)
    out = os.path.join(HERE, "intake", "case-intake.html")
    with open(out, "w", encoding="utf-8") as f:
        f.write(html)
    return out


if __name__ == "__main__":
    n = build_md()
    p = build_html()
    print("Вопросов: %d" % n)
    print("INTAKE.md и %s собраны" % os.path.relpath(p, ROOT))
