export function FieldWrapper({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="nx-field">
      <label className="nx-label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {error ? (
        <span className="nx-error-text">{error}</span>
      ) : hint ? (
        <span className="nx-hint">{hint}</span>
      ) : null}
    </div>
  );
}

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: string;
};

export function TextField({
  label,
  error,
  hint,
  id,
  className,
  ...props
}: InputProps) {
  const inputId = id ?? `field-${label.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <FieldWrapper label={label} htmlFor={inputId} error={error} hint={hint}>
      <input
        id={inputId}
        className={`nx-input ${error ? 'nx-input-error' : ''} ${className ?? ''}`}
        {...props}
      />
    </FieldWrapper>
  );
}

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  error?: string;
  hint?: string;
};

export function TextareaField({
  label,
  error,
  hint,
  id,
  className,
  ...props
}: TextareaProps) {
  const inputId = id ?? `field-${label.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <FieldWrapper label={label} htmlFor={inputId} error={error} hint={hint}>
      <textarea
        id={inputId}
        className={`nx-textarea ${error ? 'nx-input-error' : ''} ${className ?? ''}`}
        {...props}
      />
    </FieldWrapper>
  );
}

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  error?: string;
  hint?: string;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
};

export function SelectField({
  label,
  error,
  hint,
  id,
  className,
  options,
  placeholder,
  ...props
}: SelectProps) {
  const inputId = id ?? `field-${label.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <FieldWrapper label={label} htmlFor={inputId} error={error} hint={hint}>
      <select
        id={inputId}
        className={`nx-select ${error ? 'nx-input-error' : ''} ${className ?? ''}`}
        {...props}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldWrapper>
  );
}
