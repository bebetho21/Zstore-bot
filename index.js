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

const OWNER_ROLE_NAME = "Dono";
const CLIENT_ROLE_NAME = "Cliente";

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

  // ================= COMANDOS =================

  if (command === "comandos") {

    const embed = new EmbedBuilder()
      .setTitle("📦 Comandos do Bot")
      .setColor("Blue")
      .setDescription(`
\`!criarproduto\` - Criar novo produto
\`!comandos\` - Mostrar todos os comandos
      `);

    return message.reply({ embeds: [embed] });
  }

  // ================= CRIAR PRODUTO =================

  if (command === "criarproduto") {

    if (!message.member.roles.cache.some(r => r.name === OWNER_ROLE_NAME))
      return message.reply("❌ Apenas Donos podem usar.");

    const id = Date.now().toString();
    const produtos = loadProdutos();

    produtos[id] = {
      nome: "Novo Produto",
      descricao: "Defina a descrição",
      imagem: "",
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

    message.reply({ embeds: [embed], components: [row] });
  }
});

client.on("interactionCreate", async (interaction) => {

  const produtos = loadProdutos();

  if (interaction.isButton()) {

    if (interaction.customId.startsWith("star_")) {

      await interaction.deferReply({ ephemeral: true });

      const estrelas = interaction.customId.split("_")[1];

      const canal = interaction.guild.channels.cache.find(c => c.name === "💖・feedbacks");

      if (canal) {
        const embed = new EmbedBuilder()
          .setTitle("⭐ Nova Avaliação")
          .setDescription(`Usuário: ${interaction.user}\nNota: ${"⭐".repeat(estrelas)}`)
          .setColor("Gold");

        canal.send({ embeds: [embed] });
      }

      return interaction.editReply("✅ Avaliação enviada!");
    }

    if (interaction.customId.startsWith("fechar_ticket")) {

      if (!interaction.member.roles.cache.some(r => r.name === OWNER_ROLE_NAME))
        return interaction.reply({ content: "❌ Apenas Dono pode fechar.", ephemeral: true });

      return interaction.channel.delete();
    }

    const [tipo, id] = interaction.customId.split("_");
    if (!produtos[id]) return;

    if (tipo === "opcao") {

      const modal = new ModalBuilder()
        .setCustomId(`modal_opcao_${id}`)
        .setTitle("Adicionar Opção");

      const nome = new TextInputBuilder()
        .setCustomId("nome")
        .setLabel("Nome")
        .setStyle(TextInputStyle.Short);

      const preco = new TextInputBuilder()
        .setCustomId("preco")
        .setLabel("Preço")
        .setStyle(TextInputStyle.Short);

      const estoque = new TextInputBuilder()
        .setCustomId("estoque")
        .setLabel("Estoque")
        .setStyle(TextInputStyle.Short);

      modal.addComponents(
        new ActionRowBuilder().addComponents(nome),
        new ActionRowBuilder().addComponents(preco),
        new ActionRowBuilder().addComponents(estoque)
      );

      return interaction.showModal(modal);
    }

    if (tipo === "publicar") {

      const select = new StringSelectMenuBuilder()
        .setCustomId(`comprar_${id}`)
        .setPlaceholder("🛒 Escolha o plano");

      produtos[id].opcoes.forEach((op, i) => {
        select.addOptions({
          label: op.nome,
          description: `R$${op.preco} | Estoque: ${op.estoque}`,
          value: i.toString()
        });
      });

      const embed = new EmbedBuilder()
        .setTitle(produtos[id].nome)
        .setDescription(produtos[id].descricao)
        .setImage(produtos[id].imagem || null)
        .setColor("Blue");

      interaction.channel.send({
        embeds: [embed],
        components: [new ActionRowBuilder().addComponents(select)]
      });

      return interaction.reply({ content: "Produto publicado!", ephemeral: true });
    }
  }

  if (interaction.isModalSubmit()) {

    const id = interaction.customId.split("_")[2];
    if (!produtos[id]) return;

    produtos[id].opcoes.push({
      nome: interaction.fields.getTextInputValue("nome"),
      preco: interaction.fields.getTextInputValue("preco"),
      estoque: parseInt(interaction.fields.getTextInputValue("estoque"))
    });

    saveProdutos(produtos);
    return interaction.reply({ content: "Opção adicionada!", ephemeral: true });
  }

  if (interaction.isStringSelectMenu()) {

    const id = interaction.customId.split("_")[1];
    const opcao = produtos[id].opcoes[interaction.values[0]];

    if (opcao.estoque <= 0)
      return interaction.reply({ content: "❌ Sem estoque.", ephemeral: true });

    opcao.estoque -= 1;
    saveProdutos(produtos);

    const cargo = interaction.guild.roles.cache.find(r => r.name === CLIENT_ROLE_NAME);
    if (cargo) await interaction.member.roles.add(cargo);

    const categoria = await interaction.guild.channels.create({
      name: `ticket-${interaction.user.username}`,
      type: ChannelType.GuildCategory
    });

    const canal = await interaction.guild.channels.create({
      name: "compra",
      type: ChannelType.GuildText,
      parent: categoria.id,
      permissionOverwrites: [
        {
          id: interaction.guild.id,
          deny: [PermissionsBitField.Flags.ViewChannel]
        },
        {
          id: interaction.user.id,
          allow: [PermissionsBitField.Flags.ViewChannel]
        },
        {
          id: interaction.guild.roles.cache.find(r => r.name === OWNER_ROLE_NAME).id,
          allow: [PermissionsBitField.Flags.ViewChannel]
        }
      ]
    });

    const fecharBtn = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("fechar_ticket")
        .setLabel("Fechar Ticket")
        .setStyle(ButtonStyle.Danger)
    );

    canal.send({
      content: `🎟 ${interaction.user} aguarde um Dono responder.\nProduto: ${opcao.nome}`,
      components: [fecharBtn]
    });

    const avaliarRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("star_1").setLabel("⭐").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("star_2").setLabel("⭐⭐").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("star_3").setLabel("⭐⭐⭐").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("star_4").setLabel("⭐⭐⭐⭐").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("star_5").setLabel("⭐⭐⭐⭐⭐").setStyle(ButtonStyle.Success)
    );

    return interaction.reply({
      content: `✅ Compra realizada! Cargo Cliente adicionado.\nAvalie sua experiência:`,
      components: [avaliarRow],
      ephemeral: true
    });
  }

});

client.login(process.env.TOKEN);