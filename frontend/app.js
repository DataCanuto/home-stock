const CATEGORIAS = {
    "armario-superior": { label: "Armário Superior", descricao: "Temperos e itens do dia a dia", tabelaId: "armario-superior-table" },
    "armario-inferior": { label: "Armário Inferior", descricao: "Grãos, massas, óleos, farinhas...", tabelaId: "armario-inferior-table" },
    "armario-gatas": { label: "Armário das Gatas", descricao: "Ração, churu, areia...", tabelaId: "armario-gatas-table" },
    congelador: { label: "Congelador", descricao: "Carnes, aves, molhos", tabelaId: "congelador-table" },
    geladeira: { label: "Geladeira", descricao: "Folhas, laticínios, vegetais", tabelaId: "geladeira-table" },
    fruteira: { label: "Fruteira", descricao: "Banana, cebola, tomate...", tabelaId: "fruteira-table" },
    dispensa: { label: "Dispensa", descricao: "Materiais de limpeza", tabelaId: "dispensa-table" },
    banheiro: { label: "Banheiro", descricao: "Sabonete líquido, shampoo, fio dental...", tabelaId: "banheiro-table" },
    farmacia: { label: "Farmácia", descricao: "Remédios, protetor solar, cosméticos...", tabelaId: "farmacia-table" }
};

const API_URL = "http://localhost:3000/produtos";

let produtosCache = [];
let produtoEmEdicaoId = null;
let categoriaEmVisualizacao = null;

// normaliza para minúsculas e remove acentos (via NFD, descartando os marcadores diacríticos resultantes)
// para permitir busca tolerante a acentuação, sem depender de escapes unicode no código-fonte
function removerAcentos(texto) {
    return texto
        .toString()
        .normalize("NFD")
        .split("")
        .filter(caractere => {
            const codigo = caractere.codePointAt(0);
            return codigo < 0x0300 || codigo > 0x036f;
        })
        .join("")
        .toLowerCase();
}

function seletorCorpoTabela(categoria) {
    return `#${CATEGORIAS[categoria].tabelaId} tbody`;
}

async function carregarProdutos() {

    Object.keys(CATEGORIAS).forEach(categoria => {
        document.querySelector(seletorCorpoTabela(categoria)).innerHTML = "";
    });

    const resposta = await fetch(API_URL);
    const produtos = await resposta.json();

    produtosCache = produtos;

    const contagemPorCategoria = {};

    produtos.forEach(produto => {

        if (!CATEGORIAS[produto.categoria]) {
            return;
        }

        contagemPorCategoria[produto.categoria] = (contagemPorCategoria[produto.categoria] || 0) + 1;

        const tbody = document.querySelector(seletorCorpoTabela(produto.categoria));
        tbody.appendChild(criarLinhaTabelaCategoria(produto));
    });

    Object.keys(CATEGORIAS).forEach(categoria => {
        if (!contagemPorCategoria[categoria]) {
            const tbody = document.querySelector(seletorCorpoTabela(categoria));
            tbody.appendChild(criarLinhaVazia());
        }
    });
}

function criarLinhaVazia() {
    const linha = document.createElement("tr");
    linha.classList.add("linha-vazia");
    linha.innerHTML = `<td colspan="3" class="text-muted text-center py-3">Nenhum item cadastrado</td>`;
    return linha;
}

function criarLinhaTabelaCategoria(produto) {
    const linha = document.createElement("tr");
    linha.dataset.produtoId = produto.id;

    const disponivel = parseFloat(produto.quantidade) > 0;
    linha.classList.add(disponivel ? "produto-disponivel" : "produto-indisponivel");

    linha.innerHTML = `
        <td>${produto.nome}</td>
        <td>${produto.quantidade} ${produto.unidade}</td>
        <td>
            <button type="button" class="btn btn-sm btn-outline-primary btn-editar-produto" data-id="${produto.id}">
                <i class="bi bi-pencil-square"></i>
            </button>
        </td>
    `;

    return linha;
}

function criarLinhaVerCategoria(produto) {
    const linha = document.createElement("tr");
    linha.dataset.produtoId = produto.id;

    const disponivel = parseFloat(produto.quantidade) > 0;

    linha.innerHTML = `
        <td>${produto.nome}</td>
        <td>${produto.quantidade} ${produto.unidade}</td>
        <td><span class="badge ${disponivel ? "bg-success" : "bg-danger"}">${disponivel ? "Disponível" : "Indisponível"}</span></td>
        <td>
            <button type="button" class="btn btn-sm btn-outline-primary btn-editar-produto" data-id="${produto.id}">
                <i class="bi bi-pencil-square"></i>
            </button>
            <button type="button" class="btn btn-sm btn-outline-danger btn-excluir-produto" data-id="${produto.id}">
                <i class="bi bi-trash3"></i>
            </button>
        </td>
    `;

    return linha;
}

function obterModalInstance(seletor) {
    const modalEl = document.querySelector(seletor);
    return bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
}

function abrirModalEdicao(produto) {
    produtoEmEdicaoId = produto.id;

    document.querySelector("#nome-produto").value = produto.nome;
    document.querySelector("#select-categoria").value = produto.categoria;
    document.querySelector("#qtd-produto").value = produto.quantidade;
    document.querySelector("#select-unidade").value = produto.unidade;

    document.querySelector("#cadastrar-produto-label").textContent = "Editar Produto";

    obterModalInstance("#cadastrar-produto").show();
}

async function excluirProduto(id) {
    const confirmar = confirm("Deseja realmente excluir este produto? Esta ação não pode ser desfeita.");

    if (!confirmar) {
        return;
    }

    try {
        const resposta = await fetch(`${API_URL}/${id}`, { method: "DELETE" });

        if (!resposta.ok) {
            throw new Error("Erro ao excluir produto");
        }

        await carregarProdutos();

        if (categoriaEmVisualizacao) {
            renderizarModalCategoria(categoriaEmVisualizacao);
        }

    } catch (erro) {
        console.error(erro);
        alert("Não foi possível excluir o produto.");
    }
}

async function cadastrarProduto() {

    const form = document.querySelector("#form-cadastro-produto");

    if (!form.reportValidity()) {
        return;
    }

    const nome = document.querySelector("#nome-produto").value.trim();
    const categoria = document.querySelector("#select-categoria").value;
    const quantidade = document.querySelector("#qtd-produto").value;
    const unidade = document.querySelector("#select-unidade").value;

    const emEdicao = produtoEmEdicaoId !== null;
    const url = emEdicao ? `${API_URL}/${produtoEmEdicaoId}` : API_URL;
    const metodo = emEdicao ? "PUT" : "POST";

    try {
        const resposta = await fetch(url, {
            method: metodo,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nome, categoria, quantidade, unidade })
        });

        if (!resposta.ok) {
            throw new Error(emEdicao ? "Erro ao atualizar produto" : "Erro ao cadastrar produto");
        }

        obterModalInstance("#cadastrar-produto").hide();

        await carregarProdutos();

        if (categoriaEmVisualizacao) {
            renderizarModalCategoria(categoriaEmVisualizacao);
        }

    } catch (erro) {
        console.error(erro);
        alert("Não foi possível salvar o produto. Verifique conexão e sistema.");
    }
}

async function confirmarExclusao() {
    const select = document.querySelector("#select-produto-excluir");
    const id = Number(select.value);

    if (!id) {
        alert("Selecione um produto para excluir.");
        return;
    }

    await excluirProduto(id);

    obterModalInstance("#excluir-produto").hide();
}

// preenche o modal "espelho" da categoria com todos os itens correspondentes
function renderizarModalCategoria(categoria) {
    const config = CATEGORIAS[categoria];

    if (!config) {
        return;
    }

    categoriaEmVisualizacao = categoria;

    document.querySelector("#ver-categoria-label").textContent = config.label;
    document.querySelector("#ver-categoria-descricao").textContent = config.descricao;

    const tbody = document.querySelector("#ver-categoria-table tbody");
    tbody.innerHTML = "";

    const produtosDaCategoria = produtosCache.filter(produto => produto.categoria === categoria);

    const tabela = document.querySelector("#ver-categoria-table");
    const vazio = document.querySelector("#ver-categoria-vazio");

    if (produtosDaCategoria.length === 0) {
        tabela.classList.add("d-none");
        vazio.classList.remove("d-none");
        return;
    }

    tabela.classList.remove("d-none");
    vazio.classList.add("d-none");

    produtosDaCategoria.forEach(produto => {
        tbody.appendChild(criarLinhaVerCategoria(produto));
    });
}

// rola até o card da categoria e destaca a linha do produto encontrado pela busca
function focarProduto(produto) {
    const cardEl = document.querySelector(`#card-${produto.categoria}`);

    if (cardEl) {
        cardEl.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    const linha = document.querySelector(`${seletorCorpoTabela(produto.categoria)} tr[data-produto-id="${produto.id}"]`);

    if (linha) {
        linha.classList.add("linha-destaque");
        setTimeout(() => linha.classList.remove("linha-destaque"), 1600);
    }

    abrirModalEdicao(produto);
}

// monta a lista de sugestões de busca (nome, categoria, quantidade e unidade)
function buscarProdutos(termo) {
    const termoNormalizado = removerAcentos(termo.trim());

    if (!termoNormalizado) {
        return [];
    }

    return produtosCache.filter(produto => {
        const categoriaLabel = CATEGORIAS[produto.categoria]?.label || produto.categoria;
        const textoBusca = removerAcentos(`${produto.nome} ${categoriaLabel} ${produto.quantidade} ${produto.unidade}`);
        return textoBusca.includes(termoNormalizado);
    }).slice(0, 8);
}

function renderizarResultadosBusca(resultados) {
    const lista = document.querySelector("#busca-resultados");
    lista.innerHTML = "";

    if (resultados.length === 0) {
        lista.classList.remove("mostrar");
        return;
    }

    resultados.forEach(produto => {
        const categoriaLabel = CATEGORIAS[produto.categoria]?.label || produto.categoria;
        const disponivel = parseFloat(produto.quantidade) > 0;

        const item = document.createElement("li");
        item.className = "list-group-item list-group-item-action d-flex justify-content-between align-items-center";
        item.innerHTML = `
            <span>
                <strong>${produto.nome}</strong>
                <span class="text-muted small d-block">${categoriaLabel} · ${produto.quantidade} ${produto.unidade}</span>
            </span>
            <span class="badge ${disponivel ? "bg-success" : "bg-danger"} rounded-pill">${disponivel ? "Disponível" : "Indisponível"}</span>
        `;

        item.addEventListener("click", () => {
            document.querySelector("#input-busca").value = "";
            lista.classList.remove("mostrar");
            focarProduto(produto);
        });

        lista.appendChild(item);
    });

    lista.classList.add("mostrar");
}

document.querySelector("#btn-salvar-produto").addEventListener("click", cadastrarProduto);
document.querySelector("#btn-confirmar-exclusao").addEventListener("click", confirmarExclusao);

// prefiltra a categoria quando o modal de cadastro é aberto a partir do botão de um card específico
document.querySelector("#cadastrar-produto").addEventListener("show.bs.modal", (evento) => {
    if (produtoEmEdicaoId !== null) {
        return;
    }

    const botao = evento.relatedTarget;
    const categoria = botao?.dataset.categoria;

    if (categoria) {
        document.querySelector("#select-categoria").value = categoria;
    }
});

// limpa o formulário e o estado de edição sempre que o modal de cadastro é fechado
document.querySelector("#cadastrar-produto").addEventListener("hidden.bs.modal", () => {
    document.querySelector("#form-cadastro-produto").reset();
    document.querySelector("#cadastrar-produto-label").textContent = "Cadastrar Produto";
    produtoEmEdicaoId = null;
});

// popula a lista de produtos do modal de exclusão, filtrando pela categoria do botão que abriu o modal
document.querySelector("#excluir-produto").addEventListener("show.bs.modal", (evento) => {
    const botao = evento.relatedTarget;
    const categoria = botao?.dataset.categoria;

    const produtosFiltrados = categoria
        ? produtosCache.filter(produto => produto.categoria === categoria)
        : produtosCache;

    const select = document.querySelector("#select-produto-excluir");
    select.innerHTML = `<option value="" selected disabled>Selecione</option>`;

    produtosFiltrados.forEach(produto => {
        const opcao = document.createElement("option");
        opcao.value = produto.id;
        opcao.textContent = `${produto.nome} — ${produto.quantidade} ${produto.unidade}`;
        select.appendChild(opcao);
    });
});

// modal "espelho": mostra todos os itens da categoria clicada no título do card
document.querySelector("#ver-categoria").addEventListener("show.bs.modal", (evento) => {
    const botao = evento.relatedTarget;
    const categoria = botao?.dataset.categoria;

    if (categoria) {
        renderizarModalCategoria(categoria);
    }
});

document.querySelector("#ver-categoria").addEventListener("hidden.bs.modal", () => {
    categoriaEmVisualizacao = null;
});

// fecha o modal de categoria e abre o de cadastro já com a categoria selecionada
document.querySelector("#btn-adicionar-da-categoria").addEventListener("click", () => {
    const categoria = categoriaEmVisualizacao;
    const verCategoriaModalEl = document.querySelector("#ver-categoria");

    verCategoriaModalEl.addEventListener("hidden.bs.modal", () => {
        if (categoria) {
            document.querySelector("#select-categoria").value = categoria;
        }
        obterModalInstance("#cadastrar-produto").show();
    }, { once: true });

    obterModalInstance("#ver-categoria").hide();
});

// delegação de eventos para os botões Editar/Excluir criados dinamicamente nas tabelas
document.addEventListener("click", (evento) => {

    const botaoEditar = evento.target.closest(".btn-editar-produto");

    if (botaoEditar) {
        const id = Number(botaoEditar.dataset.id);
        const produto = produtosCache.find(p => p.id === id);

        if (produto) {
            abrirModalEdicao(produto);
        }
        return;
    }

    const botaoExcluir = evento.target.closest(".btn-excluir-produto");

    if (botaoExcluir) {
        const id = Number(botaoExcluir.dataset.id);
        excluirProduto(id);
    }
});

// busca rápida: pesquisa por nome, categoria, quantidade ou unidade e navega até o item
const inputBusca = document.querySelector("#input-busca");
const buscaWrapper = document.querySelector("#busca-wrapper");

document.querySelector("#form-busca").addEventListener("submit", (evento) => evento.preventDefault());

inputBusca.addEventListener("input", () => {
    renderizarResultadosBusca(buscarProdutos(inputBusca.value));
});

inputBusca.addEventListener("focus", () => {
    if (inputBusca.value.trim()) {
        renderizarResultadosBusca(buscarProdutos(inputBusca.value));
    }
});

document.addEventListener("click", (evento) => {
    if (!buscaWrapper.contains(evento.target)) {
        document.querySelector("#busca-resultados").classList.remove("mostrar");
    }
});

inputBusca.addEventListener("keydown", (evento) => {
    if (evento.key === "Escape") {
        inputBusca.value = "";
        document.querySelector("#busca-resultados").classList.remove("mostrar");
        inputBusca.blur();
    }
});

carregarProdutos();
