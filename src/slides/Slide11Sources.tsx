import { R, Words, Label, useScene } from '../components/ui'
import type { SlideProps } from '../types'

const FASHION = [
  'Barthes R. Système de la Mode. Paris: Éditions du Seuil, 1967. (англ. переклад: The Fashion System. New York: Hill and Wang, 1983.)',
  'Entwistle J. The Fashioned Body: Fashion, Dress and Modern Social Theory. Cambridge: Polity Press, 2000.',
  'Roach-Higgins M. E., Eicher J. B. Dress and Identity. Clothing and Textiles Research Journal. 1992. Vol. 10, No. 4. P. 1–8.',
  'Hebdige D. Subculture: The Meaning of Style. London: Methuen, 1979.',
  'Simmel G. Fashion. American Journal of Sociology. 1957. Vol. 62, No. 6. P. 541–558.',
]
const SPEECH = [
  'Андерсон К. Успішні виступи на TED. Рецепти найкращих спікерів. Київ: Наш Формат, 2016.',
  'Кушнір Р. О. Великий оратор, або як говорити так, щоб Вам аплодували стоячи. Дрогобич: Коло, 2013.',
  'Радевич-Винницький Я. Етикет і культура спілкування. Львів, 2001.',
  'Мацюк З., Станкевич Н. Українська мова професійного спілкування. Київ: Каравела, 2023.',
  'Щепанська Х., Чучвара А., Кухарчишин М. Професійна риторика вчителя-словесника. Львів, 2025.',
]

const List = ({ items, from, i }: { items: string[]; from: number; i: number }) => (
  <ol className="srcs">
    {items.map((s, k) => (
      <R i={i + k} as="li" key={k}>
        <span className="n">[{from + k}]</span>
        <span>{s}</span>
      </R>
    ))}
  </ol>
)

export default function Slide11Sources(_: SlideProps) {
  useScene({ visible: 0, fabric: 0, garment: '#7C1F2B' }, [])
  return (
    <div className="s11">
      <Label>Джерела</Label>
      <h2 className="hd sm"><Words text="Використана *література*" i={1} /></h2>
      <div className="src-cols">
        <div>
          <R i={3} as="h4">Мода, культура, ідентичність</R>
          <List items={FASHION} from={1} i={4} />
        </div>
        <div>
          <R i={5} as="h4">Підготовка та мовлення виступу</R>
          <List items={SPEECH} from={6} i={6} />
        </div>
      </div>
      <R i={12} className="micro">
        Для ілюстрацій і подальшого перегляду: колекції Costume Institute (The Metropolitan Museum of Art) та відділу моди Victoria and Albert Museum.
        <br />
        3D-манекен: «Female display mannequin» (standing, walking pose), 3DAssets.dev, ліцензія CC0 1.0 — https://3dassets.dev
      </R>
    </div>
  )
}
