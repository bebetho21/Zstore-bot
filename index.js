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
  ChannelSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType
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
const FEEDBACK_CHANNEL_ID = "1464846455218114683";

if (!fs.existsSync(produtosFile)) {
  fs.writeFileSync(produtosFile, JSON.stringify({}));
}

function loadProdutos() {
  return JSON.parse(fs.readFileSync(produtosFile));
}

function saveProdutos(data) {
  fs.writeFileSync(produtosFile, JSON.stringify(data, null, 2));
}

client.once("ready", () => {
  console.log(`✅ Bot online como ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  if (!message.content.startsWith(prefix) || message.author.bot) return;

  const command = message.content.slice(prefix.length).toLowerCase();

  // COMANDOS
  if (command === "comandos") {
    return message.reply(`
📦 **Comandos**
!criarproduto
!clientes (dar cargo manual)
!comandos
    `);
  }

  // DAR CARGO MANUAL
  if (command === "clientes") {
    const cargo = message.guild.roles.cache.find(r => r.name === "Clientes");
    if (!cargo) return message.reply("Cargo Clientes não encontrado.");

    await message.member.roles.add(cargo);
    return message.reply("✅ Cargo Clientes adicionado.");
  }

  // CRIAR PRODUTO
  if (command === "criarproduto") {

    const id = Date.now().toString();
    const produtos = loadProdutos();

    produtos[id] = {
      nome: "Novo Produto",
      descricao: "Defina a descrição",
      imagem: "",
      canal: null,
      opcoes: []
    };

    saveProdutos(produtos);

    const embed = new EmbedBuilder()
      .setTitle("📦 Criar Produto")
      .setDescription("Configure usando os botões.")
      .setColor("Blue");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`nome_${id}`).setLabel("Nome").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`desc_${id}`).setLabel("Descrição").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`img_${id}`).setLabel("Imagem").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`opcao_${id}`).setLabel("Adicionar Opção").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`publicar_${id}`).setLabel("Publicar").setStyle(ButtonStyle.Danger)
    );

    return message.reply({ embeds: [embed], components: [row] });
  }
});

client.on("interactionCreate", async (interaction) => {

  const produtos = loadProdutos();

  // BOTÕES
  if (interaction.isButton()) {

    const [tipo, id] = interaction.customId.split("_");
    if (!produtos[id]) return;

    // NOME
    if (tipo === "nome") {
      const modal = new ModalBuilder()
        .setCustomId(`modal_nome_${id}`)
        .setTitle("Editar Nome");

      const input = new TextInputBuilder()
        .setCustomId("nome_input")
        .setLabel("Nome do produto")
        .setStyle(TextInputStyle.Short);

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      return interaction.showModal(modal);
    }

    // DESCRIÇÃO
    if (tipo === "desc") {
      const modal = new ModalBuilder()
        .setCustomId(`modal_desc_${id}`)
        .setTitle("Editar Descrição");

      const input = new TextInputBuilder()
        .setCustomId("desc_input")
        .setLabel("Descrição")
        .setStyle(TextInputStyle.Paragraph);

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      return interaction.showModal(modal);
    }

    // IMAGEM
    if (tipo === "img") {
      const modal = new ModalBuilder()
        .setCustomId(`modal_img_${id}`)
        .setTitle("URL da Imagem");

      const input = new TextInputBuilder()
        .setCustomId("img_input")
        .setLabel("URL")
        .setStyle(TextInputStyle.Short);

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      return interaction.showModal(modal);
    }

    // OPÇÃO COM ESTOQUE
    if (tipo === "opcao") {
      const modal = new ModalBuilder()
        .setCustomId(`modal_opcao_${id}`)
        .setTitle("Adicionar Opção");

      const nome = new TextInputBuilder()
        .setCustomId("op_nome")
        .setLabel("Nome da opção")
        .setStyle(TextInputStyle.Short);

      const preco = new TextInputBuilder()
        .setCustomId("op_preco")
        .setLabel("Preço")
        .setStyle(TextInputStyle.Short);

      const estoque = new TextInputBuilder()
        .setCustomId("op_estoque")
        .setLabel("Quantidade em estoque")
        .setStyle(TextInputStyle.Short);

      modal.addComponents(
        new ActionRowBuilder().addComponents(nome),
        new ActionRowBuilder().addComponents(preco),
        new ActionRowBuilder().addComponents(estoque)
      );

      return interaction.showModal(modal);
    }

    // PUBLICAR
    if (tipo === "publicar") {
      const menu = new ChannelSelectMenuBuilder()
        .setCustomId(`canal_${id}`)
        .setPlaceholder("Selecione o canal")
        .addChannelTypes(ChannelType.GuildText);

      return interaction.reply({
        content: "Escolha o canal:",
        components: [new ActionRowBuilder().addComponents(menu)],
        ephemeral: true
      });
    }

    // AVALIAÇÃO
    if (interaction.customId.startsWith("star_")) {

      const estrelas = interaction.customId.split("_")[1];
      const canal = interaction.guild.channels.cache.get(FEEDBACK_CHANNEL_ID);

      const embed = new EmbedBuilder()
        .setTitle("⭐ Nova Avaliação")
        .setDescription(`Usuário: ${interaction.user}\nNota: ${"⭐".repeat(estrelas)}`)
        .setColor("Gold");

      canal.send({ embeds: [embed] });

      return interaction.reply({ content: "Avaliação enviada!", ephemeral: true });
    }
  }

  // MODAIS
  if (interaction.isModalSubmit()) {

    const id = interaction.customId.split("_")[2];
    if (!produtos[id]) return;

    if (interaction.customId.startsWith("modal_nome_")) {
      produtos[id].nome = interaction.fields.getTextInputValue("nome_input");
    }

    if (interaction.customId.startsWith("modal_desc_")) {
      produtos[id].descricao = interaction.fields.getTextInputValue("desc_input");
    }

    if (interaction.customId.startsWith("modal_img_")) {
      produtos[id].imagem = interaction.fields.getTextInputValue("img_input");
    }

    if (interaction.customId.startsWith("modal_opcao_")) {
      produtos[id].opcoes.push({
        nome: interaction.fields.getTextInputValue("op_nome"),
        preco: interaction.fields.getTextInputValue("op_preco"),
        estoque: parseInt(interaction.fields.getTextInputValue("op_estoque"))
      });
    }

    saveProdutos(produtos);
    return interaction.reply({ content: "Salvo com sucesso!", ephemeral: true });
  }

  // PUBLICAÇÃO
  if (interaction.isChannelSelectMenu()) {

    const id = interaction.customId.split("_")[1];
    produtos[id].canal = interaction.values[0];
    saveProdutos(produtos);

    const canal = interaction.guild.channels.cache.get(produtos[id].canal);

    const embed = new EmbedBuilder()
      .setTitle(produtos[id].nome)
      .setDescription(produtos[id].descricao)
      .setImage(produtos[id].imagem || null)
      .setColor("Blue");

    const select = new StringSelectMenuBuilder()
      .setCustomId(`comprar_${id}`)
      .setPlaceholder("🛒 Escolha o plano");

    produtos[id].opcoes.forEach((op, i) => {
      select.addOptions({
        label: `${op.nome}`,
        description: `R$${op.preco} | Estoque: ${op.estoque}`,
        value: i.toString()
      });
    });

    canal.send({
      embeds: [embed],
      components: [new ActionRowBuilder().addComponents(select)]
    });

    return interaction.reply({ content: "Produto publicado!", ephemeral: true });
  }

  // COMPRA
  if (interaction.isStringSelectMenu()) {

    const id = interaction.customId.split("_")[1];
    const opcao = produtos[id].opcoes[interaction.values[0]];

    if (opcao.estoque <= 0)
      return interaction.reply({ content: "❌ Produto sem estoque.", ephemeral: true });

    opcao.estoque -= 1;
    saveProdutos(produtos);

    const cargo = interaction.guild.roles.cache.find(r => r.name === "Clientes");
    if (cargo) await interaction.member.roles.add(cargo);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("star_1").setLabel("⭐").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("star_2").setLabel("⭐⭐").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("star_3").setLabel("⭐⭐⭐").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("star_4").setLabel("⭐⭐⭐⭐").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("star_5").setLabel("⭐⭐⭐⭐⭐").setStyle(ButtonStyle.Success)
    );

    return interaction.reply({
      content: `✅ Compra realizada! Cargo Clientes adicionado.\nEstoque restante: ${opcao.estoque}\nAvalie sua experiência:`,
      components: [row],
      ephemeral: true
    });
  }

});

client.login(process.env.TOKEN);