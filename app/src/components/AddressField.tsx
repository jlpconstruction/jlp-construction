import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { suggestAddresses, type AddressSuggestion } from '../lib/address'

type Props = { value: string; onChange: (street: string) => void; onPick: (s: AddressSuggestion) => void }

/** Street address box that suggests real addresses as you type (keyboard and screen-reader friendly). */
export default function AddressField({ value, onChange, onPick }: Props) {
  const { t } = useTranslation()
  const [items, setItems] = useState<AddressSuggestion[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const typed = useRef(false) // only search after the customer types, not after a pick

  useEffect(() => {
    const q = value.trim()
    if (!typed.current || q.length < 4 || !/\d/.test(q)) {
      setItems([])
      return
    }
    const ctrl = new AbortController()
    const timer = setTimeout(() => {
      suggestAddresses(q, ctrl.signal)
        .then((found) => {
          setItems(found)
          setOpen(found.length > 0)
          setActive(-1)
        })
        .catch(() => setItems([])) // offline or service down: typing by hand still works
    }, 300)
    return () => {
      clearTimeout(timer)
      ctrl.abort()
    }
  }, [value])

  const pick = (s: AddressSuggestion) => {
    typed.current = false
    onPick(s)
    setOpen(false)
    setItems([])
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open || !items.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => (a + 1) % items.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => (a <= 0 ? items.length - 1 : a - 1))
    } else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault()
      pick(items[active])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className="addr">
      <input
        id="f-addr"
        className="input"
        value={value}
        maxLength={200}
        autoComplete="off"
        required
        role="combobox"
        aria-expanded={open}
        aria-controls="f-addr-list"
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `f-addr-opt-${active}` : undefined}
        aria-describedby="f-addr-hint"
        onChange={(e) => {
          typed.current = true
          onChange(e.target.value)
        }}
        onKeyDown={onKeyDown}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onFocus={() => items.length && setOpen(true)}
      />
      {open && (
        <ul className="addr-list" id="f-addr-list" role="listbox" aria-label={t('form.addressSuggestions')}>
          {items.map((s, i) => (
            <li
              key={s.label}
              id={`f-addr-opt-${i}`}
              role="option"
              aria-selected={active === i}
              onMouseDown={(e) => {
                e.preventDefault()
                pick(s)
              }}
            >
              {s.label}
            </li>
          ))}
        </ul>
      )}
      <div className="hint" id="f-addr-hint">
        {t('form.addressHint')}{' '}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">
          © OpenStreetMap
        </a>
      </div>
    </div>
  )
}
