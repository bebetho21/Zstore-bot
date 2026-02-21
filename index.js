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
const MUTE_ROLE = "Muted";

if (!fs.existsSync(produtosFile))
  fs.writeFileSync(produtosFile, JSON.stringify({}));

const loadProdutos = () => JSON.parse(fs.readFileSync(produtosFile));
const saveProdutos = (data) =>
  fs.writeFileSync(produtosFile, JSON.stringify(data, null, 2));

client.once("ready", () => {
  console.log(`✅ Bot online como ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  if (!message.content.startsWith(prefix) || message.author.bot) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // ================= COMANDOS =================

  if (command === "comandos") {
    const embed = new EmbedBuilder()
      .setTitle("📦 Central de Comandos")
      .setColor("Blue")
      .setDescription(`
📦 **Loja**
!criarproduto
!painelprodutos
!deletarproduto
!estoque

🎟 **Sistema**
!cliente

📢 **Admin**
!anunciar
!clear
!ban
!kick
!mute
!unmute
!enviarembed
      `);

    return message.reply({ embeds: [embed] });
  }

  // ================= CLIENTE =================

  if (command === "cliente") {
    if (!message.member.roles.cache.some(r => r.name === OWNER_ROLE))
      return message.reply("❌ Apenas Dono.");

    const cargo = message.guild.roles.cache.find(r => r.name === CLIENT_ROLE);
    if (!cargo) return message.reply("Cargo Cliente não existe.");

    await message.member.roles.add(cargo);
    return message.reply("✅ Cargo Cliente adicionado.");
  }

  // ================= ANUNCIAR =================

  if (command === "anunciar") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator))
      return message.reply("❌ Apenas admin.");

    const texto = args.join(" ");
    if (!texto) return message.reply("Escreva o anúncio.");

    const embed = new EmbedBuilder()
      .setTitle("📢 Anúncio")
      .setDescription(texto)
      .setColor("Green");

    return message.channel.send({ embeds: [embed] });
  }

  // ================= CLEAR =================

  if (command === "clear") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages))
      return message.reply("Sem permissão.");

    const quantidade = parseInt(args[0]);
    if (!quantidade) return message.reply("Digite quantidade.");

    await message.channel.bulkDelete(quantidade, true);
  }

  // ================= BAN =================

  if (command === "ban") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers))
      return message.reply("Sem permissão.");

    const membro = message.mentions.members.first();
    if (!membro) return message.reply("Mencione alguém.");

    await membro.ban();
    message.channel.send("🔨 Usuário banido.");
  }

  // ================= KICK =================

  if (command === "kick") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.KickMembers))
      return message.reply("Sem permissão.");

    const membro = message.mentions.members.first();
    if (!membro) return message.reply("Mencione alguém.");

    await membro.kick();
    message.channel.send("👢 Usuário expulso.");
  }

  // ================= MUTE =================

  if (command === "mute") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers))
      return message.reply("Sem permissão.");

    const membro = message.mentions.members.first();
    if (!membro) return message.reply("Mencione alguém.");

    await membro.timeout(10 * 60 * 1000);
    message.channel.send("🔇 Usuário mutado por 10 minutos.");
  }

  if (command === "unmute") {
    const membro = message.mentions.members.first();
    if (!membro) return message.reply("Mencione alguém.");

    await membro.timeout(null);
    message.channel.send("🔊 Usuário desmutado.");
  }

  // ================= ENVIAR EMBED =================

  if (command === "enviarembed") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator))
      return;

    const modal = new ModalBuilder()
      .setCustomId("embedModal")
      .setTitle("Criar Embed");

    const titulo = new TextInputBuilder()
      .setCustomId("titulo")
      .setLabel("Título")
      .setStyle(TextInputStyle.Short);

    const descricao = new TextInputBuilder()
      .setCustomId("descricao")
      .setLabel("Descrição")
      .setStyle(TextInputStyle.Paragraph);

    modal.addComponents(
      new ActionRowBuilder().addComponents(titulo),
      new ActionRowBuilder().addComponents(descricao)
    );

    return message.showModal(modal);
  }

  // ================= CRIAR PRODUTO =================

  if (command === "criarproduto") {

    if (!message.member.roles.cache.some(r => r.name === OWNER_ROLE))
      return message.reply("❌ Apenas Dono.");

    const id = Date.now().toString();
    const produtos = loadProdutos();

    produtos[id] = {
      nome: "Novo Produto",
      descricao: "Defina a descrição",
      imagem: "",
      opcoes: []
    };

    saveProdutos(produtos);

    return message.reply("✅ Produto criado.");
  }

  // ================= PAINEL PRODUTOS =================

  if (command === "painelprodutos") {

    const produtos = loadProdutos();

    const select = new StringSelectMenuBuilder()
      .setCustomId("painel_produtos")
      .setPlaceholder("Selecione um produto");

    Object.entries(produtos).forEach(([id, p]) => {
      select.addOptions({
        label: p.nome,
        value: id
      });
    });

    return message.channel.send({
      components: [new ActionRowBuilder().addComponents(select)]
    });
  }
});

client.login(process.env.TOKEN);