require("dotenv").config();
const fs = require("fs");

const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ChannelType,
  PermissionsBitField,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  Events,
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// ========= CONFIG =========
const STAFF_ROLE_ID = "1464846409139359784"; // COLOQUE AQUI
const produtosPath = "./produtos.json";
const ticketsPath = "./tickets.json";

// ========= CRIAR ARQUIVOS AUTOMATICAMENTE =========
if (!fs.existsSync(produtosPath)) {
  fs.writeFileSync(produtosPath, JSON.stringify([], null, 2));
}

if (!fs.existsSync(ticketsPath)) {
  fs.writeFileSync(ticketsPath, JSON.stringify({ count: 0 }, null, 2));
}

// ========= FUNÇÕES =========
function carregarProdutos() {
  try {
    return JSON.parse(fs.readFileSync(produtosPath));
  } catch {
    return [];
  }
}

function salvarProdutos(produtos) {
  fs.writeFileSync(produtosPath, JSON.stringify(produtos, null, 2));
}

function gerarNumeroTicket() {
  const data = JSON.parse(fs.readFileSync(ticketsPath));
  data.count++;
  fs.writeFileSync(ticketsPath, JSON.stringify(data, null, 2));
  return data.count.toString().padStart(3, "0");
}

// ========= BOT ONLINE =========
client.on("clientReady", () => {
  console.log(`✅ Bot online como ${client.user.tag}`);
});

// ========= COMANDOS =========
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  if (message.content === "!novoproduto") {
    const embed = new EmbedBuilder()
      .setTitle("🛠 Criar Novo Produto")
      .setDescription("Clique abaixo para criar um produto.");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("criar_produto")
        .setLabel("Criar Produto")
        .setStyle(ButtonStyle.Primary)
    );

    message.channel.send({ embeds: [embed], components: [row] });
  }

  if (message.content === "!postarproduto") {
    const produtos = carregarProdutos();
    if (produtos.length === 0)
      return message.reply("❌ Nenhum produto salvo.");

    const menu = new StringSelectMenuBuilder()
      .setCustomId("selecionar_produto_postar")
      .setPlaceholder("Faça uma seleção");

    produtos.forEach((p) => {
      menu.addOptions({
        label: p.titulo.substring(0, 100),
        description: `R$ ${p.preco}`,
        value: p.id,
      });
    });

    const row = new ActionRowBuilder().addComponents(menu);

    message.channel.send({
      content: "🛒 Selecione um produto:",
      components: [row],
    });
  }
});

// ========= INTERAÇÕES =========
client.on(Events.InteractionCreate, async (interaction) => {

  // ===== CRIAR PRODUTO =====
  if (interaction.isButton() && interaction.customId === "criar_produto") {

    const modal = new ModalBuilder()
      .setCustomId("modal_produto")
      .setTitle("Novo Produto");

    const titulo = new TextInputBuilder()
      .setCustomId("titulo")
      .setLabel("Título")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const descricao = new TextInputBuilder()
      .setCustomId("descricao")
      .setLabel("Descrição")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    const foto = new TextInputBuilder()
      .setCustomId("foto")
      .setLabel("URL da Foto")
      .setStyle(TextInputStyle.Short)
      .setRequired(false);

    const preco = new TextInputBuilder()
      .setCustomId("preco")
      .setLabel("Preço")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(titulo),
      new ActionRowBuilder().addComponents(descricao),
      new ActionRowBuilder().addComponents(foto),
      new ActionRowBuilder().addComponents(preco)
    );

    await interaction.showModal(modal);
  }

  if (interaction.isModalSubmit() && interaction.customId === "modal_produto") {

    const produtos = carregarProdutos();

    const novo = {
      id: Date.now().toString(),
      titulo: interaction.fields.getTextInputValue("titulo"),
      descricao: interaction.fields.getTextInputValue("descricao"),
      foto: interaction.fields.getTextInputValue("foto"),
      preco: interaction.fields.getTextInputValue("preco"),
    };

    produtos.push(novo);
    salvarProdutos(produtos);

    interaction.reply({ content: "✅ Produto salvo!", flags: 64 });
  }

  // ===== POSTAR PRODUTO =====
  if (interaction.isStringSelectMenu() && interaction.customId === "selecionar_produto_postar") {

    const produtos = carregarProdutos();
    const produto = produtos.find(p => p.id === interaction.values[0]);

    if (!produto)
      return interaction.reply({ content: "❌ Produto não encontrado.", flags: 64 });

    const embed = new EmbedBuilder()
      .setTitle(produto.titulo)
      .setDescription(produto.descricao)
      .addFields({ name: "💰 Preço", value: `R$ ${produto.preco}` });

    if (produto.foto) embed.setImage(produto.foto);

    const menu = new StringSelectMenuBuilder()
      .setCustomId(`comprar_${produto.id}`)
      .setPlaceholder("Comprar produto")
      .addOptions({
        label: "Comprar",
        description: "Clique para iniciar a compra",
        value: produto.id,
      });

    const row = new ActionRowBuilder().addComponents(menu);

    interaction.reply({ embeds: [embed], components: [row] });
  }

  // ===== CLIENTE ESCOLHE COMPRAR =====
  if (interaction.isStringSelectMenu() && interaction.customId.startsWith("comprar_")) {

    const produtoId = interaction.values[0];

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`ticket_${produtoId}`)
        .setLabel("🎫 Ir para o Ticket")
        .setStyle(ButtonStyle.Success)
    );

    interaction.reply({
      content: "Clique abaixo para abrir seu ticket:",
      components: [row],
      flags: 64
    });
  }

  // ===== CRIAR TICKET =====
  if (interaction.isButton() && interaction.customId.startsWith("ticket_")) {

    if (!interaction.guild.roles.cache.has(STAFF_ROLE_ID)) {
      return interaction.reply({
        content: "❌ ID do cargo staff inválido.",
        flags: 64
      });
    }

    const produtoId = interaction.customId.split("_")[1];
    const produtos = carregarProdutos();
    const produto = produtos.find(p => p.id === produtoId);

    if (!produto)
      return interaction.reply({ content: "❌ Produto não encontrado.", flags: 64 });

    const numero = gerarNumeroTicket();

    const canal = await interaction.guild.channels.create({
      name: `ticket-${numero}`,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        {
          id: interaction.guild.id,
          deny: [PermissionsBitField.Flags.ViewChannel],
        },
        {
          id: interaction.user.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
          ],
        },
        {
          id: STAFF_ROLE_ID,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
          ],
        },
      ],
    });

    const embed = new EmbedBuilder()
      .setTitle(`🛒 Produto: ${produto.titulo}`)
      .setDescription(produto.descricao)
      .addFields({ name: "💰 Preço", value: `R$ ${produto.preco}` });

    if (produto.foto) embed.setImage(produto.foto);

    const fechar = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("fechar_ticket")
        .setLabel("🔒 Fechar Ticket")
        .setStyle(ButtonStyle.Danger)
    );

    canal.send({
      content: `Olá ${interaction.user}, aguarde um staff responder.`,
      embeds: [embed],
      components: [fechar],
    });

    interaction.reply({ content: `✅ Ticket criado: ${canal}`, flags: 64 });
  }

  // ===== FECHAR TICKET =====
  if (interaction.isButton() && interaction.customId === "fechar_ticket") {

    if (!interaction.member.roles.cache.has(STAFF_ROLE_ID)) {
      return interaction.reply({
        content: "❌ Apenas staff pode fechar.",
        flags: 64
      });
    }

    await interaction.reply("🔒 Fechando ticket...");
    setTimeout(() => {
      interaction.channel.delete().catch(() => {});
    }, 3000);
  }

});

client.login(process.env.TOKEN);