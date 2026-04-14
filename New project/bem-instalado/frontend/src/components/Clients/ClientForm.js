import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';

const emptyForm = {
  name: '',
  phone: '',
  email: '',
  street: '',
  house_number: '',
  neighborhood: '',
  city: '',
  state: '',
  zip_code: '',
  address_reference: '',
  address: '',
};

export default function ClientForm({ client = null, onClose, onSaved }) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!client) {
      setForm(emptyForm);
      return;
    }

    setForm({
      name: client.name || '',
      phone: client.phone || '',
      email: client.email || '',
      street: client.street || '',
      house_number: client.house_number || '',
      neighborhood: client.neighborhood || '',
      city: client.city || '',
      state: client.state || '',
      zip_code: client.zip_code || '',
      address_reference: client.address_reference || '',
      address: client.address || '',
    });
  }, [client]);

  const handleChange = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.name.trim() || !form.phone.trim()) {
      toast.error('Preencha pelo menos nome e telefone.');
      return;
    }

    setSaving(true);

    try {
      if (client?.id) {
        await api.put(`/clients/${client.id}`, form);
        toast.success('Cliente atualizado.');
      } else {
        await api.post('/clients', form);
        toast.success('Cliente cadastrado.');
      }

      onSaved?.();
      onClose?.();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível salvar o cliente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(4,4,4,0.72)] px-4 backdrop-blur-md">
      <div className="lux-panel max-h-[calc(100vh-2rem)] w-full max-w-3xl overflow-y-auto p-6 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="eyebrow">{client ? 'Editar contato' : 'Novo contato'}</p>
            <h2 className="mt-3 text-2xl font-semibold text-[var(--text)]">
              {client ? 'Atualizar cliente' : 'Cadastrar cliente'}
            </h2>
            <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
              Salve endereço detalhado para que o instalador possa abrir a rota no GPS direto da agenda.
            </p>
          </div>

          <button className="ghost-button !min-h-0 !px-4 !py-2 text-xs" onClick={onClose} type="button">
            Fechar
          </button>
        </div>

        <form className="mt-6 grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
          <label className="block md:col-span-2">
            <span className="field-label">Nome</span>
            <input
              className="field-input"
              name="name"
              onChange={handleChange}
              placeholder="Nome completo"
              value={form.name}
            />
          </label>

          <label className="block">
            <span className="field-label">Telefone</span>
            <input
              className="field-input"
              name="phone"
              onChange={handleChange}
              placeholder="(00) 00000-0000"
              value={form.phone}
            />
          </label>

          <label className="block">
            <span className="field-label">E-mail</span>
            <input
              className="field-input"
              name="email"
              onChange={handleChange}
              placeholder="cliente@email.com"
              type="email"
              value={form.email}
            />
          </label>

          <label className="block md:col-span-2">
            <span className="field-label">Rua</span>
            <input
              className="field-input"
              name="street"
              onChange={handleChange}
              placeholder="Rua da instalação"
              value={form.street}
            />
          </label>

          <label className="block">
            <span className="field-label">Número</span>
            <input
              className="field-input"
              name="house_number"
              onChange={handleChange}
              placeholder="Nº"
              value={form.house_number}
            />
          </label>

          <label className="block">
            <span className="field-label">Bairro</span>
            <input
              className="field-input"
              name="neighborhood"
              onChange={handleChange}
              placeholder="Bairro"
              value={form.neighborhood}
            />
          </label>

          <label className="block">
            <span className="field-label">Cidade</span>
            <input
              className="field-input"
              name="city"
              onChange={handleChange}
              placeholder="Cidade"
              value={form.city}
            />
          </label>

          <label className="block">
            <span className="field-label">Estado</span>
            <input
              className="field-input"
              maxLength={2}
              name="state"
              onChange={handleChange}
              placeholder="UF"
              value={form.state}
            />
          </label>

          <label className="block">
            <span className="field-label">CEP</span>
            <input
              className="field-input"
              name="zip_code"
              onChange={handleChange}
              placeholder="00000-000"
              value={form.zip_code}
            />
          </label>

          <label className="block md:col-span-2">
            <span className="field-label">Especificação / Referência</span>
            <textarea
              className="field-textarea"
              name="address_reference"
              onChange={handleChange}
              placeholder="Ex.: casa com portão preto, fundos, torre B..."
              rows="3"
              value={form.address_reference}
            />
          </label>

          <label className="block md:col-span-2">
            <span className="field-label">Endereço livre (opcional)</span>
            <textarea
              className="field-textarea"
              name="address"
              onChange={handleChange}
              placeholder="Texto livre para complemento"
              rows="3"
              value={form.address}
            />
          </label>

          <div className="mt-2 flex flex-wrap gap-3 md:col-span-2">
            <button className="gold-button w-full sm:w-auto" disabled={saving} type="submit">
              {saving ? 'Salvando...' : client ? 'Salvar alterações' : 'Criar cliente'}
            </button>
            <button className="ghost-button w-full sm:w-auto" onClick={onClose} type="button">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
