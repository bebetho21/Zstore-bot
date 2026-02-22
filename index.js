require("dotenv").config();
const fs = require("fs");
const {
  Client,
  GatewayIntentBits,
  Partials,
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
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel]
});

const PREFIX = "!";
const STAFF_ROLE_ID = "1473874493712892046";
const LOG_CHANNEL_ID = "1475202362338709727";

const configPath = "./config.json";
let config = {
  titulo: "Atendimento Alta Group - PS5",
  descricao: "Selecione a categoria para abrir um ticket.",
  thumbnail: "",
  thumbnail: "",
  categorias: [
    { nome: "Suporte", descricao: "Dúvidas e problemas." },
    { nome: "Doações", descricao: "Informações sobre doações." },
    { nome: "Denúncias", descricao: "Denuncie irregularidades." },
    { nome: "Denúncias Staff", descricao: "Denuncie membros da staff." },
    { nome: "Revisão de Banimento", descricao: "Solicite revisão." }
  ],
  ticketCount: 0
};

if (fs.existsSync(configPath)) {
  config = JSON.parse(fs.readFileSync(configPath));
}

function saveConfig() {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

const openTickets = new Map();

client.once("ready", () => {
  console.log(`Bot online como ${client.user.tag}`);
});


// =============================
// COMANDOS
// =============================
client.on("messageCreate", async (message) => {
  if (!message.guild || message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  // PAINEL
  if (cmd === "painel") {
    const embed = new EmbedBuilder()
      .setTitle(config.titulo)
      .setDescription(config.descricao)
      .setColor("Gold");
      .setThumbnail('https://cdn.discordapp.com/attachments/1473874983662129224/1475207977777758269/WhatsApp_Image_2026-02-20_at_11.24.27.jpeg');

    if (config.thumbnail) embed.setThumbnail(config.thumbnail);

    const menu = new StringSelectMenuBuilder()
      .setCustomId("select_categoria")
      .setPlaceholder("Selecione a categoria")
      .addOptions(
        config.categorias.map(cat => ({
          label: cat.nome,
          description: cat.descricao,
          value: cat.nome
        }))
      );

    const row = new ActionRowBuilder().addComponents(menu);

    message.channel.send({ embeds: [embed], components: [row] });
  }

  // EDITAR PAINEL
  if (cmd === "editarpainel") {
    if (!message.member.roles.cache.has(STAFF_ROLE_ID)) return;

    const tipo = args.shift();
    const texto = args.join(" ");

    if (!tipo) return message.reply("Use: !editarpainel titulo/descricao/thumbnail <texto>");

    if (tipo === "titulo") config.titulo = texto;
    if (tipo === "descricao") config.descricao = texto;
    if (tipo === "thumbnail") config.thumbnail = texto;

    saveConfig();
    message.reply("Painel atualizado com sucesso.");
  }

  if (cmd === "adicionarcategoria") {
    if (!message.member.roles.cache.has(STAFF_ROLE_ID)) return;

    const nome = args.shift();
    const descricao = args.join(" ");
    config.categorias.push({ nome, descricao });
    saveConfig();
    message.reply("Categoria adicionada.");
  }

  if (cmd === "removercategoria") {
    if (!message.member.roles.cache.has(STAFF_ROLE_ID)) return;

    const nome = args.join(" ");
    config.categorias = config.categorias.filter(c => c.nome !== nome);
    saveConfig();
    message.reply("Categoria removida.");
  }

  if (cmd === "editarcategoria") {
    if (!message.member.roles.cache.has(STAFF_ROLE_ID)) return;

    const nome = args.shift();
    const novaDesc = args.join(" ");

    const cat = config.categorias.find(c => c.nome === nome);
    if (!cat) return message.reply("Categoria não encontrada.");

    cat.descricao = novaDesc;
    saveConfig();
    message.reply("Categoria atualizada.");
  }

  if (cmd === "helpalta") {
    message.reply(`
!painel
!editarpainel titulo <texto>
!editarpainel descricao <texto>
!editarpainel thumbnail <url>
!adicionarcategoria <nome> <descrição>
!removercategoria <nome>
!editarcategoria <nome> <nova descrição>
    `);
  }
});


// =============================
// INTERAÇÕES
// =============================
client.on("interactionCreate", async (interaction) => {

  // SELECT
  if (interaction.isStringSelectMenu() && interaction.customId === "select_categoria") {

    if (openTickets.has(interaction.user.id)) {
      return interaction.reply({ content: "Você já possui um ticket aberto.", ephemeral: true });
    }

    const categoria = interaction.values[0];

    const modal = new ModalBuilder()
      .setCustomId(`modal_${categoria}`)
      .setTitle("Abrir Ticket");

    const assuntoInput = new TextInputBuilder()
      .setCustomId("assunto")
      .setLabel("Assunto do Ticket")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(assuntoInput));
    await interaction.showModal(modal);
  }

  // MODAL
  if (interaction.isModalSubmit() && interaction.customId.startsWith("modal_")) {

    const categoria = interaction.customId.replace("modal_", "");
    const assunto = interaction.fields.getTextInputValue("assunto");

    config.ticketCount++;
    saveConfig();

    const ticketId = config.ticketCount;
    openTickets.set(interaction.user.id, ticketId);

    const channel = await interaction.guild.channels.create({
      name: `ticket-${ticketId}`,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        {
          id: interaction.guild.roles.everyone,
          deny: [PermissionsBitField.Flags.ViewChannel]
        },
        {
          id: interaction.user.id,
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
        },
        {
          id: STAFF_ROLE_ID,
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
        }
      ]
    });

    const embed = new EmbedBuilder()
      .setColor('#2b2d31')
      .setTitle('📁 Atendimento Alta Group Roleplay - PS5 💛')
      .setDescription(`Olá ${interaction.user}\n\nAguarde um membro da equipe responder.`)
      .addFields(
        { name: '📂 Categoria:', value: `\`${categoria}\`` },
        { name: '🌐 ID:', value: `\`${ticketId}\`` },
        { name: '📝 Assunto:', value: `\`${assunto}\`` }
        )
        .setThumbnail('https://cdn.discordapp.com/attachments/1473874983662129224/1475207977777758269/WhatsApp_Image_2026-02-20_at_11.24.27.jpeg');
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("assumir_ticket")
        .setLabel("⭐ Assumir Ticket")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("fechar_ticket")
        .setLabel("❌ Fechar Ticket")
        .setStyle(ButtonStyle.Danger)
    );

    await channel.send({ embeds: [embed], components: [row] });

    await interaction.reply({
      content: `Ticket criado com sucesso: ${channel}`,
      ephemeral: true
    });
  }

  // BOTÕES
  if (interaction.isButton()) {

    const member = await interaction.guild.members.fetch(interaction.user.id);
    const isStaff = member.roles.cache.has(STAFF_ROLE_ID);

    if (interaction.customId === "assumir_ticket") {
      if (!isStaff)
        return interaction.reply({ content: "Apenas a staff pode assumir.", ephemeral: true });

      await interaction.reply(`Ticket assumido por ${interaction.user}`);
    }

    if (interaction.customId === "fechar_ticket") {
      if (!isStaff)
        return interaction.reply({ content: "Apenas a staff pode fechar.", ephemeral: true });

      await interaction.reply("Fechando em 5 segundos...");
      setTimeout(() => {
        interaction.channel.delete().catch(() => {});
      }, 5000);
    }
  }
});

client.login(process.env.TOKEN);

client.on("messageCreate", async (message) => {
  if (!message.guild || message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  // =============================
  // PAINEL
  // =============================
  if (cmd === "painel") {
    const embed = new EmbedBuilder()
      .setTitle(config.titulo)
      .setDescription(config.descricao)
      .setColor("Gold");

    if (config.thumbnail) embed.setImage(config.thumbnail);

    const menu = new StringSelectMenuBuilder()
      .setCustomId("select_categoria")
      .setPlaceholder("Selecione a categoria")
      .addOptions(
        config.categorias.map(cat => ({
          label: cat.nome,
          description: cat.descricao,
          value: cat.nome
        }))
      );

    const row = new ActionRowBuilder().addComponents(menu);

    message.channel.send({ embeds: [embed], components: [row] });
  }

  // =============================
  // HELPALTA
  // =============================
  if (cmd === "helpalta") {
    const helpEmbed = new EmbedBuilder()
      .setTitle("Comandos - Alta Group")
      .setColor("Blue")
      .setDescription(`
!painel - Enviar painel de atendimento
!editarpainel titulo <texto>
!editarpainel descricao <texto>
!editarpainel thumbnail <url>
!adicionarcategoria <nome> <descrição>
!removercategoria <nome>
!editarcategoria <nome> <nova descrição>
!helpalta - Ver todos comandos
      `);

    message.channel.send({ embeds: [helpEmbed] });
  }
});

client.on("interactionCreate", async (interaction) => {
  // =============================
  // SELECT CATEGORIA
  // =============================
  if (interaction.isStringSelectMenu() && interaction.customId === "select_categoria") {
    const categoria = interaction.values[0];

    if (openTickets.has(interaction.user.id)) {
      return interaction.reply({ content: "Você já possui um ticket aberto.", ephemeral: true });
    }

    const modal = new ModalBuilder()
      .setCustomId(`modal_${categoria}`)
      .setTitle("Abrir Ticket - Alta Group");

    const assuntoInput = new TextInputBuilder()
      .setCustomId("assunto")
      .setLabel("Assunto do Ticket")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const row = new ActionRowBuilder().addComponents(assuntoInput);
    modal.addComponents(row);

    await interaction.showModal(modal);
  }

  // =============================
  // MODAL ENVIADO
  // =============================
  if (interaction.isModalSubmit() && interaction.customId.startsWith("modal_")) {
    const categoria = interaction.customId.replace("modal_", "");
    const assunto = interaction.fields.getTextInputValue("assunto");

    config.ticketCount++;
    saveConfig();

    const ticketId = config.ticketCount;
    openTickets.set(interaction.user.id, ticketId);

    const channel = await interaction.guild.channels.create({
      name: `ticket-${ticketId}`,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        {
          id: interaction.guild.roles.everyone,
          deny: [PermissionsBitField.Flags.ViewChannel]
        },
        {
          id: interaction.user.id,
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
        },
        {
          id: STAFF_ROLE_ID,
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
        }
      ]
    });

    const embed = new EmbedBuilder()
      .setTitle("Ticket - Alta Group")
      .setColor("Gold")
      .setDescription(`
Categoria: ${categoria}
ID: ${ticketId}
Assunto: ${assunto}

Aguarde um membro da equipe responder.
      `);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("assumir_ticket")
        .setLabel("Assumir Ticket")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("fechar_ticket")
        .setLabel("Fechar Ticket")
        .setStyle(ButtonStyle.Danger)
    );

    await channel.send({ embeds: [embed], components: [row] });

    const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
    if (logChannel) {
      logChannel.send(`Ticket ${ticketId} criado por ${interaction.user.tag}`);
    }

    await interaction.reply({
      content: `Ticket criado com sucesso: ${channel}`,
      ephemeral: true
    });
  }
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  const member = await interaction.guild.members.fetch(interaction.user.id);
  const isStaff = member.roles.cache.has(STAFF_ROLE_ID);

  // =============================
  // ASSUMIR TICKET
  // =============================
  if (interaction.customId === "assumir_ticket") {
    if (!isStaff) {
      return interaction.reply({ content: "Apenas a staff pode assumir tickets.", ephemeral: true });
    }

    await interaction.reply({
      content: `Ticket assumido por ${interaction.user}`,
      ephemeral: false
    });

    const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
    if (logChannel) {
      logChannel.send(`Ticket ${interaction.channel.name} assumido por ${interaction.user.tag}`);
    }
  }

  // =============================
  // FECHAR TICKET
  // =============================
  if (interaction.customId === "fechar_ticket") {
    if (!isStaff) {
      return interaction.reply({ content: "Apenas a staff pode fechar tickets.", ephemeral: true });
    }

    await interaction.reply("Ticket será fechado em 5 segundos...");

    const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
    if (logChannel) {
      logChannel.send(`Ticket ${interaction.channel.name} fechado por ${interaction.user.tag}`);
    }

    setTimeout(() => {
      interaction.channel.delete().catch(() => {});
    }, 5000);
  }
});

// =============================
// EDIÇÃO DO PAINEL
// =============================
client.on("messageCreate", async (message) => {
  if (!message.guild || message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  if (cmd === "editarpainel") {
    if (!message.member.roles.cache.has(STAFF_ROLE_ID)) return;

    const tipo = args.shift();
    const texto = args.join(" ");

    if (tipo === "titulo") config.titulo = texto;
    if (tipo === "descricao") config.descricao = texto;
    if (tipo === "thumbnail") config.thumbnail = texto;

    saveConfig();
    message.reply("Painel atualizado com sucesso.");
  }

  if (cmd === "adicionarcategoria") {
    if (!message.member.roles.cache.has(STAFF_ROLE_ID)) return;

    const nome = args.shift();
    const descricao = args.join(" ");
    config.categorias.push({ nome, descricao });
    saveConfig();
    message.reply("Categoria adicionada.");
  }

  if (cmd === "removercategoria") {
    if (!message.member.roles.cache.has(STAFF_ROLE_ID)) return;

    const nome = args.join(" ");
    config.categorias = config.categorias.filter(c => c.nome !== nome);
    saveConfig();
    message.reply("Categoria removida.");
  }

  if (cmd === "editarcategoria") {
    if (!message.member.roles.cache.has(STAFF_ROLE_ID)) return;

    const nome = args.shift();
    const novaDesc = args.join(" ");

    const cat = config.categorias.find(c => c.nome === nome);
    if (!cat) return message.reply("Categoria não encontrada.");

    cat.descricao = novaDesc;
    saveConfig();
    message.reply("Categoria atualizada.");
  }
});

