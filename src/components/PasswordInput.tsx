"use client";

import { useRef, useState } from "react";
import { FiEye, FiEyeOff } from "react-icons/fi";

interface Props {
  id: string;
  name: string;
  invalid?: boolean;
  describedBy?: string;
}

/**
 * Campo de senha com "Mostrar". Em senha longa digitada no celular, errar uma
 * letra obriga a redigitar tudo sem poder conferir. Devolve campo + botão como
 * irmãos (fragmento) para ocupar as faixas de `.field__row`, igual ao "Colar".
 * O formulário continua sendo o POST nativo: sem JS, o campo segue funcionando.
 */
export function PasswordInput({ id, name, invalid, describedBy }: Props) {
  const [visible, setVisible] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        id={id}
        name={name}
        ref={inputRef}
        type={visible ? "text" : "password"}
        className="input"
        autoComplete="current-password"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="go"
        required
        autoFocus
        aria-invalid={invalid ? true : undefined}
        aria-describedby={describedBy}
      />
      <button
        type="button"
        className="btn btn--quiet btn--icon"
        aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
        onClick={() => {
          setVisible((v) => !v);
          // O foco fica no campo: o toque no botão não pode fechar o teclado.
          inputRef.current?.focus();
        }}
      >
        {visible ? <FiEyeOff aria-hidden="true" /> : <FiEye aria-hidden="true" />}
        <span className="btn__label">{visible ? "Ocultar" : "Mostrar"}</span>
      </button>
    </>
  );
}
