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
let config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));

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

    if (command === 'suporte') {
        const embed = new EmbedBuilder()
            .setTitle(config.suporte.titulo)
            .setDescription(config.suporte.descricao)
            .setThumbnail(config.suporte.thumbnail)
            .setColor('Yellow');

        const select = new StringSelectMenuBuilder()
            .setCustomId('ticket_select')
            .setPlaceholder('Selecione o motivo do contato...')
            .addOptions([
                { label: '🛠️ Suporte', value: 'Suporte' },
                { label: '💰 Doações', value: 'Doações' },
                { label: '🚨 Denúncias', value: 'Denúncias' },
                { label: '👮 Denúncias Staff', value: 'Denúncias Staff' },
                { label: '🔄 Revisões de Banimento', value: 'Revisões' }
            ]);

        const row = new ActionRowBuilder().addComponents(select);
        await message.channel.send({ embeds: [embed], components: [row] });
    }

    if (command === 'helpalta') {
        const embed = new EmbedBuilder()
            .setTitle('📖 Comandos Alta Group')
            .setDescription('`!suporte` - Envia o painel de tickets\n`!editarpainel` - Edita título e descrição\n`!setthumbnail` - Altera a thumbnail\n`!setcategoria` - Define categoria dos tickets\n`!setcargoatendente` - Define cargo de suporte')
            .setColor('Gold');
        message.channel.send({ embeds: [embed] });
    }

    if (command === 'editarpainel') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;
        const sub = args.shift();
        if (sub === 'titulo') {
            config.suporte.titulo = args.join(' ');
            saveConfig();
            message.reply('✅ Título atualizado!');
        } else if (sub === 'desc') {
            config.suporte.descricao = args.join(' ');
            saveConfig();
            message.reply('✅ Descrição atualizada!');
        } else {
            message.reply('Uso: `!editarpainel titulo <texto>` ou `!editarpainel desc <texto>`');
        }
    }

    if (command === 'setthumbnail') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;
        const url = args[0];
        if (!url || !url.startsWith('http')) return message.reply('❌ URL inválida!');
        config.suporte.thumbnail = url;
        saveConfig();
        message.reply('✅ Thumbnail atualizada!');
    }

    if (command === 'setcategoria') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;
        const id = args[0];
        if (!id) return message.reply('❌ Forneça o ID da categoria!');
        config.suporte.categoria_id = id;
        saveConfig();
        message.reply('✅ Categoria de tickets definida!');
    }

    if (command === 'setcargoatendente') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;
        const role = message.mentions.roles.first() || { id: args[0] };
        if (!role.id) return message.reply('❌ Mencione ou forneça o ID do cargo!');
        config.suporte.cargo_atendente = role.id;
        saveConfig();
        message.reply('✅ Cargo de atendente definido!');
    }
});

client.on('interactionCreate', async (interaction) => {
    if (interaction.isStringSelectMenu()) {
        if (interaction.customId === 'ticket_select') {
            const modal = new ModalBuilder()
                .setCustomId(`modal_ticket_${interaction.values[0]}`)
                .setTitle(`Ticket: ${interaction.values[0]}`);

            const subjectInput = new TextInputBuilder()
                .setCustomId('ticket_subject')
                .setLabel('Assunto do Ticket')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Descreva brevemente o motivo do contato...')
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(subjectInput));
            await interaction.showModal(modal);
        }
    }

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
                    { name: '📂 Categoria', value: categoria, inline: true },
                    { name: '🆔 ID do Ticket', value: ticketId, inline: true },
                    { name: '📝 Assunto', value: assunto },
                    { name: '⚠️ Aviso', value: 'Por favor, não chame a Staff no privado. Aguarde ser atendido aqui.' }
                );

            const buttons = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('assume_ticket').setLabel('Assumir Ticket').setEmoji('⭐').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('admin_panel').setLabel('Painel Admin').setEmoji('🛡️').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('close_ticket').setLabel('Fechar Ticket').setEmoji('❌').setStyle(ButtonStyle.Danger)
            );

            await channel.send({ content: `${interaction.user} ${config.suporte.cargo_atendente ? `<@&${config.suporte.cargo_atendente}>` : ''}`, embeds: [embed], components: [buttons] });
            await interaction.editReply(`✅ Seu ticket foi criado em ${channel}`);
        }
    }

    if (interaction.isButton()) {
        if (interaction.customId === 'close_ticket') {
            if (config.suporte.cargo_atendente && !interaction.member.roles.cache.has(config.suporte.cargo_atendente)) {
                return interaction.reply({ content: '❌ Apenas a Staff pode fechar este ticket.', ephemeral: true });
            }
            await interaction.reply('🔒 Este ticket será fechado em 5 segundos...');
            setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
        }

        if (interaction.customId === 'assume_ticket') {
            if (config.suporte.cargo_atendente && !interaction.member.roles.cache.has(config.suporte.cargo_atendente)) {
                return interaction.reply({ content: '❌ Apenas a Staff pode assumir tickets.', ephemeral: true });
            }
            await interaction.reply({ content: `✅ Ticket assumido por ${interaction.user}!` });
            interaction.message.edit({ components: [new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('assume_ticket').setLabel(`Assumido por ${interaction.user.username}`).setDisabled(true).setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('admin_panel').setLabel('Painel Admin').setEmoji('🛡️').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('close_ticket').setLabel('Fechar Ticket').setEmoji('❌').setStyle(ButtonStyle.Danger)
            )] });
        }

        if (interaction.customId === 'admin_panel') {
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return interaction.reply({ content: '❌ Apenas Administradores!', ephemeral: true });
            }
            await interaction.reply({ content: '🛡️ Painel Administrativo do Ticket acessado com sucesso.', ephemeral: true });
        }
    }
});

client.login(process.env.TOKEN);