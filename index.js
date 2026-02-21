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
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType,
  PermissionsBitField
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent
  ]
});

const prefix = "!";
const produtosFile = "./produtos.json";
const OWNER_ROLE = "Dono";
const CLIENT_ROLE = "Cliente";

if (!fs.existsSync(produtosFile))
  fs.writeFileSync(produtosFile, JSON.stringify({}));

const loadProdutos = () => JSON.parse(fs.readFileSync(produtosFile));
const saveProdutos = (data) =>
  fs.writeFileSync(produtosFile, JSON.stringify(data, null, 2));

client.once("ready", () => {
  console.log(`✅ Bot online como ${client.user.tag}`);
});

/* =========================
   COMANDOS DE TEXTO
========================= */

client.on("messageCreate", async (message) => {
  if (!message.content.startsWith(prefix) || message.author.bot) return;

  const command = message.content.slice(prefix.length).toLowerCase();

  /* ===== COMANDOS ===== */

  if (command === "comandos") {
    const embed = new EmbedBuilder()
      .setTitle("📦 Central de Comandos")
      .setColor("Blue")
      .setDescription(`
🛠 Administração
!paineladmin
!anunciar
!clear
!ban
!kick

🛒 Loja
!painelprodutos
      `);

    return message.reply({ embeds: [embed] });
  }

  /* ===== PAINEL ADMIN ===== */

  if (command === "paineladmin") {

    if (!message.member.roles.cache.some(r => r.name === OWNER_ROLE))
      return message.reply("❌ Apenas Dono.");

    const embed = new EmbedBuilder()
      .setTitle("🛠 Painel Administrativo")
      .setDescription("Gerencie sua loja pelos botões abaixo.")
      .setColor("Purple");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("admin_criar")
        .setLabel("Criar Produto")
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId("admin_produtos")
        .setLabel("Gerenciar Produtos")
        .setStyle(ButtonStyle.Primary)
    );

    return message.channel.send({ embeds: [embed], components: [row] });
  }

  /* ===== PAINEL PRODUTOS ===== */

  if (command === "painelprodutos") {

    const produtos = loadProdutos();
    if (Object.keys(produtos).length === 0)
      return message.reply("❌ Nenhum produto criado.");

    const select = new StringSelectMenuBuilder()
      .setCustomId("ver_produto")
      .setPlaceholder("🛒 Escolha um produto");

    Object.entries(produtos).forEach(([id, p]) => {
      select.addOptions({
        label: p.nome,
        description: p.descricao,
        value: id
      });
    });

    return message.channel.send({
      components: [new ActionRowBuilder().addComponents(select)]
    });
  }

  /* ===== ADMIN BASICO ===== */

  if (command === "anunciar") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator))
      return;

    const texto = message.content.slice(prefix.length + 9);
    if (!texto) return;

    const embed = new EmbedBuilder()
      .setTitle("📢 Anúncio")
      .setDescription(texto)
      .setColor("Green");

    message.channel.send({ embeds: [embed] });
  }

  if (command.startsWith("clear")) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages))
      return;

    const qtd = parseInt(message.content.split(" ")[1]);
    if (!qtd) return;

    message.channel.bulkDelete(qtd);
  }

});

/* =========================
   INTERAÇÕES
========================= */

client.on("interactionCreate", async (interaction) => {

  const produtos = loadProdutos();

  /* ===== BOTÕES ADMIN ===== */

  if (interaction.isButton()) {

    if (interaction.customId === "admin_criar") {

      const modal = new ModalBuilder()
        .setCustomId("modal_criar_produto")
        .setTitle("Criar Produto");

      const nome = new TextInputBuilder()
        .setCustomId("nome")
        .setLabel("Nome do Produto")
        .setStyle(TextInputStyle.Short);

      const desc = new TextInputBuilder()
        .setCustomId("desc")
        .setLabel("Descrição")
        .setStyle(TextInputStyle.Paragraph);

      const img = new TextInputBuilder()
        .setCustomId("img")
        .setLabel("URL da Imagem")
        .setStyle(TextInputStyle.Short)
        .setRequired(false);

      modal.addComponents(
        new ActionRowBuilder().addComponents(nome),
        new ActionRowBuilder().addComponents(desc),
        new ActionRowBuilder().addComponents(img)
      );

      return interaction.showModal(modal);
    }

    if (interaction.customId.startsWith("comprar_")) {

      const id = interaction.customId.split("_")[1];
      const produto = produtos[id];

      const select = new StringSelectMenuBuilder()
        .setCustomId(`opcao_${id}`)
        .setPlaceholder("Escolha o plano");

      produto.opcoes.forEach((op, i) => {
        select.addOptions({
          label: op.nome,
          description: `R$${op.preco} | Estoque: ${op.estoque}`,
          value: i.toString()
        });
      });

      return interaction.reply({
        components: [new ActionRowBuilder().addComponents(select)],
        ephemeral: true
      });
    }

  }

  /* ===== MODAL CRIAR PRODUTO ===== */

  if (interaction.isModalSubmit()) {

    if (interaction.customId === "modal_criar_produto") {

      const id = Date.now().toString();

      produtos[id] = {
        nome: interaction.fields.getTextInputValue("nome"),
        descricao: interaction.fields.getTextInputValue("desc"),
        imagem: interaction.fields.getTextInputValue("img"),
        opcoes: []
      };

      saveProdutos(produtos);

      return interaction.reply("✅ Produto criado com sucesso!");
    }
  }

  /* ===== SELECT MENU PRODUTO ===== */

  if (interaction.isStringSelectMenu()) {

    if (interaction.customId === "ver_produto") {

      const produto = produtos[interaction.values[0]];

      const embed = new EmbedBuilder()
        .setTitle(produto.nome)
        .setDescription(produto.descricao)
        .setImage(produto.imagem || null)
        .setColor("Blue");

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`comprar_${interaction.values[0]}`)
          .setLabel("Comprar")
          .setStyle(ButtonStyle.Success)
      );

      return interaction.reply({ embeds: [embed], components: [row] });
    }

  }

});

client.login(process.env.TOKEN);