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
  ChannelType
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

function loadJSON(path, def = {}) {
  if (!fs.existsSync(path)) {
    fs.writeFileSync(path, JSON.stringify(def, null, 2));
  }
  return JSON.parse(fs.readFileSync(path));
}

function saveJSON(path, data) {
  fs.writeFileSync(path, JSON.stringify(data, null, 2));
}

client.once("ready", () => {
  console.log(`🔥 Loja ULTRA Online como ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  if (!message.content.startsWith(PREFIX) || message.author.bot) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  const produtos = loadJSON(PRODUTOS_PATH);
  const config = loadJSON(CONFIG_PATH, { staffRole: null, logsChannel: null, cupons: {} });

  if (cmd === "comandos") {
    return message.reply(`
📦 COMANDOS

!criarproduto
!listarprodutos
!deletarproduto ID
!addestoque ID quantidade
!criarcupom NOME %
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
    config.cupons[nome] = desconto;
    saveJSON(CONFIG_PATH, config);
    return message.reply("✅ Cupom criado.");
  }

  if (cmd === "listarprodutos") {
    return message.reply(Object.keys(produtos).join("\n") || "Nenhum produto.");
  }

  if (cmd === "deletarproduto") {
    delete produtos[args[0]];
    saveJSON(PRODUTOS_PATH, produtos);
    return message.reply("🗑️ Produto deletado.");
  }

  if (cmd === "addestoque") {
    const id = args[0];
    const qtd = parseInt(args[1]);
    produtos[id].estoque = (produtos[id].estoque || 0) + qtd;
    saveJSON(PRODUTOS_PATH, produtos);
    return message.reply("📦 Estoque atualizado.");
  }

  if (cmd === "criarproduto") {
    criacoes[message.author.id] = {
      nome: "Novo Produto",
      descricao: "Descrição",
      imagem: null,
      opcoes: [],
      estoque: 0,
      avaliacoes: []
    };
    return message.reply("Produto criado temporariamente. Edite no código se quiser personalizar.");
  }
});

client.on("interactionCreate", async (interaction) => {

  const produtos = loadJSON(PRODUTOS_PATH);
  const config = loadJSON(CONFIG_PATH, { staffRole: null, logsChannel: null });

  // COMPRA
  if (interaction.isStringSelectMenu()) {

    if (interaction.customId.startsWith("buy_")) {

      const id = interaction.customId.split("_")[1];
      const produto = produtos[id];

      if (!produto || produto.estoque <= 0)
        return interaction.reply({ content: "❌ Sem estoque.", ephemeral: true });

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
        .setCustomId("fechar_ticket_" + id)
        .setLabel("🔒 Fechar Ticket")
        .setStyle(ButtonStyle.Danger);

      canal.send({
        content: `🎟️ ${interaction.user}`,
        components: [new ActionRowBuilder().addComponents(fechar)]
      });

      produto.estoque -= 1;
      saveJSON(PRODUTOS_PATH, produtos);

      return interaction.reply({ content: `✅ Ticket criado: ${canal}`, ephemeral: true });
    }
  }

  // FECHAR TICKET
  if (interaction.isButton()) {

    if (interaction.customId.startsWith("fechar_ticket_")) {

      const produtoId = interaction.customId.split("_")[2];
      const produto = produtos[produtoId];

      await interaction.reply("🔒 Ticket fechado.");

      const avaliarRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("avaliar_" + produtoId + "_1").setLabel("⭐ 1").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("avaliar_" + produtoId + "_2").setLabel("⭐ 2").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("avaliar_" + produtoId + "_3").setLabel("⭐ 3").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("avaliar_" + produtoId + "_4").setLabel("⭐ 4").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("avaliar_" + produtoId + "_5").setLabel("⭐ 5").setStyle(ButtonStyle.Success)
      );

      interaction.channel.send({
        content: `${interaction.user}, avalie sua compra:`,
        components: [avaliarRow]
      });
    }

    // AVALIAÇÃO
    if (interaction.customId.startsWith("avaliar_")) {

      const parts = interaction.customId.split("_");
      const produtoId = parts[1];
      const nota = parseInt(parts[2]);
      const produto = produtos[produtoId];

      if (!produto.avaliacoes) produto.avaliacoes = [];

      if (produto.avaliacoes.find(a => a.user === interaction.user.id))
        return interaction.reply({ content: "Você já avaliou.", ephemeral: true });

      produto.avaliacoes.push({ user: interaction.user.id, nota });

      saveJSON(PRODUTOS_PATH, produtos);

      const media =
        produto.avaliacoes.reduce((a, b) => a + b.nota, 0) /
        produto.avaliacoes.length;

      if (config.logsChannel) {
        const log = interaction.guild.channels.cache.get(config.logsChannel);
        if (log)
          log.send(`⭐ Nova avaliação: ${nota} estrelas\nProduto: ${produto.nome}\nMédia: ${media.toFixed(2)}`);
      }

      return interaction.reply({ content: "✅ Avaliação registrada!", ephemeral: true });
    }
  }
});

client.login(process.env.TOKEN);