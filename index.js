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
  PermissionsBitField,
  ChannelType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const PREFIX = "!";
const PRODUTOS_PATH = "./produtos.json";
const CONFIG_PATH = "./config.json";

let criacoes = {};

function loadJSON(path, defaultData = {}) {
  if (!fs.existsSync(path)) {
    fs.writeFileSync(path, JSON.stringify(defaultData, null, 2));
  }
  return JSON.parse(fs.readFileSync(path));
}

function saveJSON(path, data) {
  fs.writeFileSync(path, JSON.stringify(data, null, 2));
}

client.once("ready", () => {
  console.log(`🔥 Loja PRO Online como ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  if (!message.content.startsWith(PREFIX) || message.author.bot) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  const produtos = loadJSON(PRODUTOS_PATH);
  const config = loadJSON(CONFIG_PATH, { staffRole: null, logsChannel: null, cupons: {} });

  if (cmd === "comandos") {
    return message.reply(`
📦 **COMANDOS DO BOT**

!criarproduto  
!listarprodutos  
!editarproduto ID  
!deletarproduto ID  
!addestoque ID quantidade  
!criarcupom NOME porcentagem  
!setstaff @cargo  
!setlogs #canal  
!comandos
    `);
  }

  if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator))
    return message.reply("❌ Apenas administradores.");

  if (cmd === "setstaff") {
    const role = message.mentions.roles.first();
    if (!role) return message.reply("Marque um cargo.");
    config.staffRole = role.id;
    saveJSON(CONFIG_PATH, config);
    return message.reply("✅ Cargo staff definido.");
  }

  if (cmd === "setlogs") {
    const canal = message.mentions.channels.first();
    if (!canal) return message.reply("Marque um canal.");
    config.logsChannel = canal.id;
    saveJSON(CONFIG_PATH, config);
    return message.reply("✅ Canal de logs definido.");
  }

  if (cmd === "criarcupom") {
    const nome = args[0];
    const desconto = parseInt(args[1]);
    if (!nome || !desconto) return message.reply("Use: !criarcupom NOME 10");
    config.cupons[nome] = desconto;
    saveJSON(CONFIG_PATH, config);
    return message.reply("✅ Cupom criado.");
  }

  if (cmd === "listarprodutos") {
    const lista = Object.keys(produtos);
    if (!lista.length) return message.reply("Nenhum produto.");
    return message.reply("📦 Produtos:\n" + lista.join("\n"));
  }

  if (cmd === "deletarproduto") {
    const id = args[0];
    if (!produtos[id]) return message.reply("Produto não existe.");
    delete produtos[id];
    saveJSON(PRODUTOS_PATH, produtos);
    return message.reply("🗑️ Produto deletado.");
  }

  if (cmd === "addestoque") {
    const id = args[0];
    const qtd = parseInt(args[1]);
    if (!produtos[id]) return message.reply("Produto não existe.");
    produtos[id].estoque = (produtos[id].estoque || 0) + qtd;
    saveJSON(PRODUTOS_PATH, produtos);
    return message.reply("📦 Estoque atualizado.");
  }

  if (cmd === "criarproduto") {

    criacoes[message.author.id] = {
      nome: null,
      descricao: null,
      imagem: null,
      opcoes: [],
      estoque: 0
    };

    const embed = new EmbedBuilder()
      .setTitle("📦 Criar Produto")
      .setDescription("Configure usando os botões.")
      .setColor("#2B2D31");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("set_nome").setLabel("Nome").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("set_desc").setLabel("Descrição").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("set_img").setLabel("Imagem").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("add_opcao").setLabel("Adicionar Opção").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("publicar_produto").setLabel("Publicar").setStyle(ButtonStyle.Danger)
    );

    return message.reply({ embeds: [embed], components: [row] });
  }
});

client.on("interactionCreate", async (interaction) => {

  const produtos = loadJSON(PRODUTOS_PATH);
  const config = loadJSON(CONFIG_PATH, { staffRole: null, logsChannel: null, cupons: {} });

  if (interaction.isButton()) {

    const userId = interaction.user.id;

    if (interaction.customId === "publicar_produto") {

      const select = new ChannelSelectMenuBuilder()
        .setCustomId("select_canal")
        .setPlaceholder("Escolha o canal")
        .addChannelTypes(ChannelType.GuildText);

      return interaction.reply({
        content: "Selecione o canal:",
        components: [new ActionRowBuilder().addComponents(select)],
        ephemeral: true
      });
    }

    if (interaction.customId === "fechar_ticket") {

      const staff = config.staffRole;
      if (
        interaction.member.roles.cache.has(staff) ||
        interaction.user.id === interaction.channel.topic
      ) {
        await interaction.reply("🔒 Fechando...");
        setTimeout(() => interaction.channel.delete(), 3000);
      } else {
        interaction.reply({ content: "❌ Apenas staff.", ephemeral: true });
      }
    }
  }

  if (interaction.isChannelSelectMenu()) {

    const canal = interaction.channels.first();
    const userId = interaction.user.id;
    const produto = criacoes[userId];

    const id = "produto_" + Date.now();
    produtos[id] = produto;
    saveJSON(PRODUTOS_PATH, produtos);

    const embed = new EmbedBuilder()
      .setTitle(produto.nome)
      .setDescription(produto.descricao)
      .setImage(produto.imagem)
      .setColor("#2B2D31");

    const select = new StringSelectMenuBuilder()
      .setCustomId("buy_" + id)
      .setPlaceholder("🛒 Escolha o plano");

    produto.opcoes.forEach(op => {
      select.addOptions({
        label: op.label,
        description: `${op.descricao} • 💰 ${op.preco}`,
        value: op.value
      });
    });

    canal.send({
      embeds: [embed],
      components: [new ActionRowBuilder().addComponents(select)]
    });

    delete criacoes[userId];

    return interaction.reply({ content: "✅ Produto publicado!", ephemeral: true });
  }

  if (interaction.isStringSelectMenu()) {

    if (interaction.customId.startsWith("buy_")) {

      const id = interaction.customId.split("_")[1];
      const produto = produtos[id];

      if (!produto.estoque || produto.estoque <= 0)
        return interaction.reply({ content: "❌ Produto sem estoque.", ephemeral: true });

      const canal = await interaction.guild.channels.create({
        name: "ticket-" + interaction.user.username,
        type: ChannelType.GuildText,
        topic: interaction.user.id,
        permissionOverwrites: [
          { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel] }
        ]
      });

      const fechar = new ButtonBuilder()
        .setCustomId("fechar_ticket")
        .setLabel("🔒 Fechar")
        .setStyle(ButtonStyle.Danger);

      canal.send({
        content: `🎟️ ${interaction.user}`,
        components: [new ActionRowBuilder().addComponents(fechar)]
      });

      produto.estoque -= 1;
      saveJSON(PRODUTOS_PATH, produtos);

      if (config.logsChannel) {
        const logChannel = interaction.guild.channels.cache.get(config.logsChannel);
        if (logChannel)
          logChannel.send(`🛒 Compra: ${interaction.user.tag} comprou ${produto.nome}`);
      }

      return interaction.reply({ content: `✅ Ticket criado: ${canal}`, ephemeral: true });
    }
  }
});

client.login(process.env.TOKEN);