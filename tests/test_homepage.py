"""Protect navigation and the real lead form while the homepage design evolves."""
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]

class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = []
        self.anchors = []
        self.forms = []
        self.current_form = None
        self.tabs = []
        self.references = []

    def handle_starttag(self, tag, pairs):
        attrs = dict(pairs)
        if attrs.get('id'):
            self.ids.append(attrs['id'])
        if tag == 'a' and attrs.get('href', '').startswith('#'):
            self.anchors.append(attrs['href'][1:])
        if tag == 'form':
            self.current_form = {'attrs': attrs, 'fields': []}
            self.forms.append(self.current_form)
        if self.current_form is not None and tag in ('input', 'select', 'textarea'):
            self.current_form['fields'].append(attrs)
        if attrs.get('role') == 'tab':
            self.tabs.append(attrs)
        for name in ('src', 'href'):
            ref = attrs.get(name, '')
            if ref.startswith('/assets/'):
                self.references.append(ref.split('?', 1)[0])

    def handle_endtag(self, tag):
        if tag == 'form':
            self.current_form = None

class HomePageContract(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.page = Page()
        cls.page.feed((ROOT / 'index.html').read_text(encoding='utf-8'))

    def test_anchors_remain_unique_and_reachable(self):
        duplicates = [value for value, count in Counter(self.page.ids).items() if count > 1]
        self.assertEqual(duplicates, [])
        self.assertTrue({'inicio', 'producto', 'beneficios', 'demo', 'implementacion', 'contacto', 'recursos'}.issubset(self.page.ids))
        self.assertEqual(set(self.page.anchors) - set(self.page.ids) - {''}, set())

    def test_single_live_lead_form_keeps_contact_and_consent_fields(self):
        forms = [form for form in self.page.forms if 'data-demo-form' in form['attrs']]
        self.assertEqual(len(forms), 1)
        fields = {field['name']: field for field in forms[0]['fields'] if 'name' in field}
        self.assertTrue({'website', 'sistema', 'nombre', 'empresa', 'email', 'telefono', 'mensaje', 'privacidad'}.issubset(fields))
        self.assertEqual(fields['sistema'].get('value'), 'Arrendamiento puro')
        self.assertEqual(fields['privacidad'].get('value'), 'acepto')
        self.assertIn('required', fields['privacidad'])
        self.assertIn('required', fields['nombre'])
        self.assertEqual(fields['website'].get('tabindex'), '-1')

    def test_journey_tabs_have_a_valid_single_initial_selection(self):
        self.assertEqual(len(self.page.tabs), 4)
        self.assertEqual(sum(t.get('aria-selected') == 'true' for t in self.page.tabs), 1)
        self.assertTrue(all(t.get('aria-controls') == 'journey-panel' for t in self.page.tabs))
        self.assertTrue(all(t.get('type') == 'button' for t in self.page.tabs))

    def test_local_assets_are_present(self):
        for reference in self.page.references:
            with self.subTest(asset=reference):
                self.assertTrue((ROOT / reference.lstrip('/')).is_file(), reference)

if __name__ == '__main__':
    unittest.main()
