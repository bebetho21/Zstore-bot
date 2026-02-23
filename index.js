const { 
    Client, 
    GatewayIntentBits, 
    Partials, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    StringSelectMenuBuilder, 
    ChannelType,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    PermissionsBitField
} = require('discord.js');
const fs = require('fs');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ],
    partials: [Partials.Message, Partials.Channel]
});

const CONFIG_FILE = './config.json';

// Inicializa ou carrega a configuração
let config = {
    suporte: {
        titulo: "Atendimento Alta Group",
        descricao: "Para iniciar seu atendimento, escolha uma das categorias abaixo no menu de seleção.",
        thumbnail: "https://i.imgur.com/8Q9Z5Xm.png", // Placeholder
        cargo_atendente: null,
        categoria_id: null
    },
    ticket_count: 0
};

if (fs.existsSync(CONFIG_FILE)) {
    config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
} else {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

function saveConfig() {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

client.on('ready', () => {
    console.log(`🤖 Alta Group logado como ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith('!')) return;

    const args = message.content.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // Comando !suporte
    if (command === 'suporte') {
        const embed = new EmbedBuilder()
            .setTitle(`📁 ${config.suporte.titulo}`)
            .setDescription(config.suporte.descricao)
            .setThumbnail(config.suporte.thumbnail)
            .setColor('Yellow')
            .setFooter({ text: 'Alta Group - Atendimento Automático' });

        const select = new StringSelectMenuBuilder()
            .setCustomId('ticket_select')
            .setPlaceholder('Selecione uma categoria...')
            .addOptions([
                { label: 'Suporte', value: 'Suporte', emoji: '🛠️' },
                { label: 'Doações', value: 'Doações', emoji: '💰' },
                { label: 'Denúncias', value: 'Denúncias', emoji: '🚨' },
                { label: 'Denúncias Staff', value: 'Denúncias Staff', emoji: '👮' },
                { label: 'Revisões de Banimento', value: 'Revisões', emoji: '🔄' }
            ]);

        const row = new ActionRowBuilder().addComponents(select);
        await message.channel.send({ embeds: [embed], components: [row] });
    }

    // Comando !helpalta
    if (command === 'helpalta') {
        const embed = new EmbedBuilder()
            .setTitle('⚙️ Painel de Comandos - Alta Group')
            .addFields(
                { name: '!suporte', value: 'Envia o painel de atendimento.' },
                { name: '!editarpainel titulo/desc <texto>', value: 'Edita o título ou descrição do painel.' },
                { name: '!setthumbnail <url>', value: 'Define a thumbnail dos tickets.' },
                { name: '!setcategoria <id>', value: 'Define a categoria onde os tickets serão criados.' },
                { name: '!setcargoatendente <id/@cargo>', value: 'Define o cargo que terá acesso aos tickets.' }
            )
            .setColor('Gold');
        message.channel.send({ embeds: [embed] });
    }

    // Comandos de Configuração (Admin)
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;

    if (command === 'editarpainel') {
        const type = args.shift()?.toLowerCase();
        const content = args.join(' ');
        if (!type || !content) return message.reply('Uso: `!editarpainel titulo/desc <texto>`');

        if (type === 'titulo') config.suporte.titulo = content;
        else if (type === 'desc') config.suporte.descricao = content;
        else return message.reply('Escolha entre `titulo` ou `desc`.');

        saveConfig();
        message.reply(`✅ ${type.charAt(0).toUpperCase() + type.slice(1)} atualizado com sucesso!`);
    }

    if (command === 'setthumbnail') {
        const url = args[0];
        if (!url || !url.startsWith('http')) return message.reply('❌ Forneça uma URL válida.');
        config.suporte.thumbnail = url;
        saveConfig();
        message.reply('✅ Thumbnail atualizada!');
    }

    if (command === 'setcategoria') {
        const id = args[0];
        if (!id) return message.reply('❌ Forneça o ID da categoria.');
        config.suporte.categoria_id = id;
        saveConfig();
        message.reply('✅ Categoria de tickets configurada!');
    }

    if (command === 'setcargoatendente') {
        const role = message.mentions.roles.first() || { id: args[0] };
        if (!role.id) return message.reply('❌ Mencione o cargo ou forneça o ID.');
        config.suporte.cargo_atendente = role.id;
        saveConfig();
        message.reply('✅ Cargo de atendente configurado!');
    }
});

client.on('interactionCreate', async (interaction) => {
    // Select Menu Interaction
    if (interaction.isStringSelectMenu()) {
        if (interaction.customId === 'ticket_select') {
            const modal = new ModalBuilder()
                .setCustomId(`modal_ticket_${interaction.values[0]}`)
                .setTitle('Assunto do Ticket');

            const input = new TextInputBuilder()
                .setCustomId('ticket_subject')
                .setLabel('Qual o motivo do seu contato?')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Descreva o assunto aqui...')
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(input));
            await interaction.showModal(modal);
        }
    }

    // Modal Submit Interaction
    if (interaction.isModalSubmit()) {
        if (interaction.customId.startsWith('modal_ticket_')) {
            const categoria = interaction.customId.replace('modal_ticket_', '');
            const assunto = interaction.fields.getTextInputValue('ticket_subject');
            const guild = interaction.guild;

            config.ticket_count++;
            saveConfig();
            const ticketId = config.ticket_count.toString().padStart(4, '0');

            await interaction.deferReply({ ephemeral: true });

            const channel = await guild.channels.create({
                name: `ticket-${interaction.user.username}`,
                type: ChannelType.GuildText,
                parent: config.suporte.categoria_id,
                permissionOverwrites: [
                    { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                    { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                    ...(config.suporte.cargo_atendente ? [{ id: config.suporte.cargo_atendente, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }] : [])
                ]
            });

            const embed = new EmbedBuilder()
                .setTitle(`🎫 Atendimento Alta Group - #${ticketId}`)
                .setThumbnail(config.suporte.thumbnail)
                .setColor('Yellow')
                .addFields(
                    { name: '👤 Cliente', value: `${interaction.user}`, inline: true },
                    { name: '📂 Categoria Escolhida', value: categoria, inline: true },
                    { name: '🆔 ID do Ticket', value: ticketId, inline: true },
                    { name: '📝 Assunto do Ticket', value: assunto },
                    { name: '⚠️ Aviso', value: 'Por favor, não chame nenhum membro da equipe no privado. Aguarde ser atendido aqui.' }
                );

            const buttons = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('assume_ticket').setLabel('Assumir Ticket').setEmoji('⭐').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('admin_panel').setLabel('Painel Admin').setEmoji('🛡️').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('close_ticket').setLabel('Fechar Ticket').setEmoji('❌').setStyle(ButtonStyle.Danger)
            );

            await channel.send({ content: `${interaction.user} ${config.suporte.cargo_atendente ? `<@&${config.suporte.cargo_atendente}>` : ''}`, embeds: [embed], components: [buttons] });
            await interaction.editReply(`✅ Seu ticket foi criado com sucesso em ${channel}`);
        }
    }

    // Button Interaction
    if (interaction.isButton()) {
        // Apenas Staff pode interagir com os botões (exceto se não houver cargo configurado)
        if (config.suporte.cargo_atendente && !interaction.member.roles.cache.has(config.suporte.cargo_atendente) && !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return interaction.reply({ content: '❌ Você não tem permissão para usar este botão.', ephemeral: true });
        }

        if (interaction.customId === 'close_ticket') {
            await interaction.reply('🔒 O ticket será fechado em 5 segundos...');
            setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
        }

        if (interaction.customId === 'assume_ticket') {
            await interaction.reply({ content: `✅ Este ticket foi assumido por ${interaction.user}!` });
            
            const assumedRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('assume_ticket').setLabel(`Assumido por ${interaction.user.username}`).setStyle(ButtonStyle.Success).setDisabled(true),
                new ButtonBuilder().setCustomId('admin_panel').setLabel('Painel Admin').setEmoji('🛡️').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('close_ticket').setLabel('Fechar Ticket').setEmoji('❌').setStyle(ButtonStyle.Danger)
            );
            
            await interaction.message.edit({ components: [assumedRow] });
        }

        if (interaction.customId === 'admin_panel') {
            await interaction.reply({ content: '🛡️ Painel Administrativo acessado. (Funcionalidade interna)', ephemeral: true });
        }
    }
});

client.login(process.env.TOKEN);