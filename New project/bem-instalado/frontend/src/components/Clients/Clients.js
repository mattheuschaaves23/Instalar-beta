import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import PageIntro from '../Layout/PageIntro';
import PaginationControls from '../Layout/PaginationControls';

const initialForm = {
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
const CLIENTS_PER_PAGE = 6;

function buildAddressSummary(client) {
  const line1 = [client.street, client.house_number && `Nº ${client.house_number}`].filter(Boolean).join(', ');
  const line2 = [client.neighborhood, [client.city, client.state].filter(Boolean).join(' - ')].filter(Boolean).join(', ');
  const line3 = client.zip_code ? `CEP ${client.zip_code}` : '';
  return [line1, line2, line3].filter(Boolean).join(' • ') || client.address || 'Não informado';
}

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [currentPage, setCurrentPage] = useState(1);

  const loadClients = async () => {
    try {
      const response = await api.get('/clients');
      setClients(response.data);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível carregar os clientes.');
    }
  };

  useEffect(() => {
    loadClients();
  }, []);

  const handleChange = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      await api.post('/clients', form);
      setForm(initialForm);
      setCurrentPage(1);
      toast.success('Cliente cadastrado.');
      loadClients();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível salvar o cliente.');
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/clients/${id}`);
      toast.success('Cliente removido.');
      loadClients();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Não foi possível remover o cliente.');
    }
  };

  const totalPages = Math.max(1, Math.ceil(clients.length / CLIENTS_PER_PAGE));
  const normalizedPage = Math.min(currentPage, totalPages);
  const start = (normalizedPage - 1) * CLIENTS_PER_PAGE;
  const paginatedClients = clients.slice(start, start + CLIENTS_PER_PAGE);
  const withDetailedAddress = clients.filter(
    (client) => client.street && client.house_number && client.city && client.state
  ).length;

  return (
    <section className="page-shell space-y-7">
      <PageIntro
        description="Cada cliente precisa entrar na sua base com endereço bem definido para facilitar orçamento, agenda e rota."
        eyebrow="Relacionamento"
        stats={[
          { label: 'Clientes ativos', value: `${clients.length}`, detail: 'Base atual cadastrada na operação.' },
          {
            label: 'Com e-mail registrado',
            value: `${clients.filter((client) => client.email).length}`,
            detail: 'Prontos para receber PDF e comunicações formais.',
          },
          {
            label: 'Endereço completo',
            value: `${withDetailedAddress}`,
            detail: 'Rua, número, cidade e estado preenchidos.',
          },
        ]}
        title="Uma carteira de clientes organizada vende mais e atrasa menos."
      />

      <div className="grid min-w-0 gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <form className="lux-panel fade-up min-w-0 p-6" onSubmit={handleSubmit}>
          <p className="eyebrow">Novo contato</p>
          <h2 className="mt-3 text-2xl font-semibold text-[var(--text)]">Adicionar cliente</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
            Preencha o endereço da instalação com o máximo de detalhe possível para agilizar a rota no dia do serviço.
          </p>

          <div className="mt-6 space-y-4">
            <label className="block">
              <span className="field-label">Nome</span>
              <input className="field-input" name="name" onChange={handleChange} placeholder="Ex.: Maria Helena" value={form.name} />
            </label>
            <label className="block">
              <span className="field-label">Telefone</span>
              <input className="field-input" name="phone" onChange={handleChange} placeholder="(00) 00000-0000" value={form.phone} />
            </label>
            <label className="block">
              <span className="field-label">E-mail</span>
              <input className="field-input" name="email" onChange={handleChange} placeholder="cliente@email.com" value={form.email} />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="field-label">Rua</span>
                <input className="field-input" name="street" onChange={handleChange} placeholder="Ex.: Rua das Palmeiras" value={form.street} />
              </label>
              <label className="block">
                <span className="field-label">Número</span>
                <input className="field-input" name="house_number" onChange={handleChange} placeholder="Ex.: 245" value={form.house_number} />
              </label>
              <label className="block">
                <span className="field-label">Bairro</span>
                <input className="field-input" name="neighborhood" onChange={handleChange} placeholder="Ex.: Centro" value={form.neighborhood} />
              </label>
              <label className="block">
                <span className="field-label">Cidade</span>
                <input className="field-input" name="city" onChange={handleChange} placeholder="Ex.: Florianópolis" value={form.city} />
              </label>
              <label className="block">
                <span className="field-label">Estado</span>
                <input className="field-input" maxLength={2} name="state" onChange={handleChange} placeholder="SC" value={form.state} />
              </label>
              <label className="block">
                <span className="field-label">CEP</span>
                <input className="field-input" name="zip_code" onChange={handleChange} placeholder="00000-000" value={form.zip_code} />
              </label>
              <label className="block sm:col-span-2">
                <span className="field-label">Especificação / Referência</span>
                <textarea
                  className="field-textarea"
                  name="address_reference"
                  onChange={handleChange}
                  placeholder="Ex.: Casa azul ao lado da farmácia, tocar interfone 3."
                  rows="3"
                  value={form.address_reference}
                />
              </label>
            </div>

            <label className="block">
              <span className="field-label">Endereço livre (opcional)</span>
              <textarea
                className="field-textarea"
                name="address"
                onChange={handleChange}
                placeholder="Texto livre para complementar o endereço"
                rows="3"
                value={form.address}
              />
            </label>
          </div>

          <button className="gold-button mt-6 w-full" type="submit">
            Salvar cliente
          </button>
        </form>

        <section className="grid gap-4">
          {paginatedClients.map((client, index) => (
            <article
              className="lux-panel-soft lift-card fade-up rounded-[26px] p-5"
              key={client.id}
              style={{ animationDelay: `${0.08 + index * 0.05}s` }}
            >
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 grid gap-3">
                  <div className="min-w-0">
                    <p className="break-words text-xl font-semibold text-[var(--text)]">{client.name}</p>
                    <p className="mt-1 text-sm text-[var(--gold-strong)]">{client.phone}</p>
                  </div>
                  <div className="grid gap-2 break-words text-sm text-[var(--muted)]">
                    <p>E-mail: {client.email || 'Não informado'}</p>
                    <p>Endereço: {buildAddressSummary(client)}</p>
                    <p>Especificação: {client.address_reference || '-'}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button className="ghost-button" onClick={() => handleDelete(client.id)} type="button">
                    Remover
                  </button>
                </div>
              </div>
            </article>
          ))}

          {clients.length > 0 ? (
            <PaginationControls
              currentPage={normalizedPage}
              onPageChange={setCurrentPage}
              totalPages={totalPages}
            />
          ) : null}

          {clients.length === 0 ? (
            <div className="empty-state">
              Nenhum cliente cadastrado ainda. Assim que você incluir os primeiros contatos, esta área
              vira a sua carteira de oportunidades.
            </div>
          ) : null}
        </section>
      </div>
    </section>
  );
}
