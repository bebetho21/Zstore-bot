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

const STAFF_ROLE_ID = "1464846409139359784";
const produtosPath = "./produtos.json";
const ticketCounterPath = "./tickets.json";

if (!fs.existsSync(ticketCounterPath)) {
  fs.writeFileSync(ticketCounterPath, JSON.stringify({ count: 0 }));
}

function carregarProdutos() {
  return JSON.parse(fs.readFileSync(produtosPath));
}

function salvarProdutos(produtos) {
  fs.writeFileSync(produtosPath, JSON.stringify(produtos, null, 2));
}

function gerarNumeroTicket() {
  const data = JSON.parse(fs.readFileSync(ticketCounterPath));
  data.count++;
  fs.writeFileSync(ticketCounterPath, JSON.stringify(data, null, 2));
  return data.count.toString().padStart(3, "0");
}

client.on("ready", () => {
  console.log(`✅ Bot online como ${client.user.tag}`);
});


// ========================
// CRIAR NOVO PRODUTO
// ========================
client.on("messageCreate", async (message) => {
  if (message.content === "!novoproduto") {
    const embed = new EmbedBuilder()
      .setTitle("🛠 Criar Novo Produto")
      .setDescription("Clique abaixo para configurar o produto.");

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
      .setPlaceholder("Selecione um produto");

    produtos.forEach((p) => {
      menu.addOptions({
        label: p.titulo,
        description: `R$ ${p.preco}`,
        value: p.id,
      });
    });

    const row = new ActionRowBuilder().addComponents(menu);
    message.channel.send({
      content: "📦 Escolha um produto para postar:",
      components: [row],
    });
  }
});


// ========================
// INTERAÇÕES
// ========================
client.on(Events.InteractionCreate, async (interaction) => {

  // Modal criação produto
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

    interaction.reply({ content: "✅ Produto salvo!", ephemeral: true });
  }

  // POSTAR PRODUTO
  if (interaction.isStringSelectMenu() && interaction.customId === "selecionar_produto_postar") {

    const produtos = carregarProdutos();
    const produto = produtos.find(p => p.id === interaction.values[0]);

    const embed = new EmbedBuilder()
      .setTitle(produto.titulo)
      .setDescription(produto.descricao)
      .addFields({ name: "💰 Preço", value: `R$ ${produto.preco}` });

    if (produto.foto) embed.setImage(produto.foto);

    const menu = new StringSelectMenuBuilder()
      .setCustomId(`comprar_${produto.id}`)
      .setPlaceholder("Deseja comprar?")
      .addOptions({
        label: "Comprar Produto",
        value: produto.id
      });

    const row = new ActionRowBuilder().addComponents(menu);

    interaction.reply({ embeds: [embed], components: [row] });
  }

  // CLIENTE ESCOLHE PRODUTO
  if (interaction.isStringSelectMenu() && interaction.customId.startsWith("comprar_")) {

    const produtoId = interaction.values[0];

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`ticket_${produtoId}`)
        .setLabel("🎫 Ir para o Ticket")
        .setStyle(ButtonStyle.Success)
    );

    interaction.reply({
      content: "Clique abaixo para abrir seu ticket.",
      components: [row],
      ephemeral: true,
    });
  }

  // CRIAR TICKET
  if (interaction.isButton() && interaction.customId.startsWith("ticket_")) {

    const produtoId = interaction.customId.split("_")[1];
    const produtos = carregarProdutos();
    const produto = produtos.find(p => p.id === produtoId);

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
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages],
        },
        {
          id: STAFF_ROLE_ID,
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages],
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

    interaction.reply({ content: `✅ Ticket criado: ${canal}`, ephemeral: true });
  }

  // FECHAR TICKET
  if (interaction.isButton() && interaction.customId === "fechar_ticket") {

    if (!interaction.member.roles.cache.has(STAFF_ROLE_ID)) {
      return interaction.reply({ content: "❌ Apenas staff pode fechar.", ephemeral: true });
    }

    interaction.reply("🔒 Fechando ticket...");
    setTimeout(() => {
      interaction.channel.delete();
    }, 3000);
  }

});

client.login(process.env.TOKEN);