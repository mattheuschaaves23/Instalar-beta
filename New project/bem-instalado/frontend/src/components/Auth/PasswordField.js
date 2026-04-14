import { useState } from 'react';

export default function PasswordField({
  label,
  name,
  value,
  onChange,
  placeholder,
  autoComplete,
}) {
  const [visible, setVisible] = useState(false);

  return (
    <label className="block">
      <span className="field-label">{label}</span>
      <div className="field-with-action">
        <input
          autoComplete={autoComplete}
          className="field-input field-input-with-action"
          name={name}
          onChange={onChange}
          placeholder={placeholder}
          type={visible ? 'text' : 'password'}
          value={value}
        />
        <button
          aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
          className="field-action"
          onClick={() => setVisible((current) => !current)}
          type="button"
        >
          {visible ? 'Ocultar' : 'Ver senha'}
        </button>
      </div>
    </label>
  );
}
