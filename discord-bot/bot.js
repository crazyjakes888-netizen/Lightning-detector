const { Client, GatewayIntentBits, PermissionFlagsBits, SlashCommandBuilder, REST, Routes, EmbedBuilder, ChannelType } = require('discord.js');
require('dotenv').config();

const TOKEN   = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

const commands = [
  new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Set up basic channels for a game server')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName('addchannel')
    .setDescription('Add a text or voice channel')
    .addStringOption(o => o.setName('name').setDescription('Channel name').setRequired(true))
    .addStringOption(o => o.setName('type').setDescription('text or voice').addChoices(
      { name: 'text', value: 'text' },
      { name: 'voice', value: 'voice' }
    ).setRequired(true))
    .addStringOption(o => o.setName('category').setDescription('Category name (optional)'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  new SlashCommandBuilder()
    .setName('delchannel')
    .setDescription('Delete a channel by name')
    .addStringOption(o => o.setName('name').setDescription('Channel name to delete').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  new SlashCommandBuilder()
    .setName('addrole')
    .setDescription('Create a new role')
    .addStringOption(o => o.setName('name').setDescription('Role name').setRequired(true))
    .addStringOption(o => o.setName('color').setDescription('Hex color e.g. #FF5733'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  new SlashCommandBuilder()
    .setName('delrole')
    .setDescription('Delete a role by name')
    .addStringOption(o => o.setName('name').setDescription('Role name to delete').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  new SlashCommandBuilder()
    .setName('announce')
    .setDescription('Post an announcement embed')
    .addStringOption(o => o.setName('message').setDescription('Announcement text').setRequired(true))
    .addStringOption(o => o.setName('channel').setDescription('Channel name (defaults to #announcements)'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  new SlashCommandBuilder()
    .setName('setwelcome')
    .setDescription('Set the welcome message for new members')
    .addStringOption(o => o.setName('message').setDescription('Welcome text. Use {user} for mention').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('Show server info'),

  new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a member')
    .addUserOption(o => o.setName('user').setDescription('User to kick').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason'))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a member')
    .addUserOption(o => o.setName('user').setDescription('User to ban').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason'))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Delete recent messages in this channel')
    .addIntegerOption(o => o.setName('count').setDescription('Number of messages (1-100)').setMinValue(1).setMaxValue(100).setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
].map(c => c.toJSON());

// Register slash commands
const rest = new REST({ version: '10' }).setToken(TOKEN);
(async () => {
  try {
    console.log('Registering slash commands…');
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log('Commands registered.');
  } catch (e) {
    console.error('Failed to register commands:', e);
  }
})();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
  ]
});

// Store welcome message per guild (in-memory; persists until bot restarts)
const welcomeMessages = new Map();

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// Welcome new members
client.on('guildMemberAdd', async member => {
  const msg = welcomeMessages.get(member.guild.id);
  if (!msg) return;
  const channel = member.guild.channels.cache.find(c => c.name === 'general' && c.type === ChannelType.GuildText);
  if (!channel) return;
  channel.send(msg.replace('{user}', member.toString()));
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const { commandName, guild } = interaction;

  try {
    // ── /setup ──
    if (commandName === 'setup') {
      await interaction.deferReply({ ephemeral: true });
      const categories = {
        'INFORMATION': ['rules', 'announcements'],
        'GENERAL':     ['general', 'off-topic'],
        'GAME':        ['game-chat', 'looking-for-group', 'screenshots'],
        'VOICE':       [],
      };
      const voiceChannels = ['General Voice', 'Game Room'];

      for (const [catName, channels] of Object.entries(categories)) {
        const cat = await guild.channels.create({ name: catName, type: ChannelType.GuildCategory });
        for (const ch of channels) {
          await guild.channels.create({ name: ch, type: ChannelType.GuildText, parent: cat.id });
        }
      }
      const voiceCat = guild.channels.cache.find(c => c.name === 'VOICE' && c.type === ChannelType.GuildCategory);
      for (const vc of voiceChannels) {
        await guild.channels.create({ name: vc, type: ChannelType.GuildVoice, parent: voiceCat?.id });
      }
      await interaction.editReply('Server setup complete! Channels created.');
    }

    // ── /addchannel ──
    else if (commandName === 'addchannel') {
      const name     = interaction.options.getString('name');
      const type     = interaction.options.getString('type');
      const catName  = interaction.options.getString('category');
      const chType   = type === 'voice' ? ChannelType.GuildVoice : ChannelType.GuildText;
      const cat      = catName ? guild.channels.cache.find(c => c.name.toLowerCase() === catName.toLowerCase() && c.type === ChannelType.GuildCategory) : undefined;
      await guild.channels.create({ name, type: chType, parent: cat?.id });
      await interaction.reply({ content: `Created ${type} channel **${name}**.`, ephemeral: true });
    }

    // ── /delchannel ──
    else if (commandName === 'delchannel') {
      const name = interaction.options.getString('name');
      const ch   = guild.channels.cache.find(c => c.name.toLowerCase() === name.toLowerCase());
      if (!ch) return interaction.reply({ content: `Channel **${name}** not found.`, ephemeral: true });
      await ch.delete();
      await interaction.reply({ content: `Deleted channel **${name}**.`, ephemeral: true });
    }

    // ── /addrole ──
    else if (commandName === 'addrole') {
      const name  = interaction.options.getString('name');
      const color = interaction.options.getString('color') || null;
      await guild.roles.create({ name, color: color || undefined, reason: 'Created via bot' });
      await interaction.reply({ content: `Role **${name}** created.`, ephemeral: true });
    }

    // ── /delrole ──
    else if (commandName === 'delrole') {
      const name = interaction.options.getString('name');
      const role = guild.roles.cache.find(r => r.name.toLowerCase() === name.toLowerCase());
      if (!role) return interaction.reply({ content: `Role **${name}** not found.`, ephemeral: true });
      await role.delete();
      await interaction.reply({ content: `Role **${name}** deleted.`, ephemeral: true });
    }

    // ── /announce ──
    else if (commandName === 'announce') {
      const message = interaction.options.getString('message');
      const chName  = interaction.options.getString('channel') || 'announcements';
      const ch      = guild.channels.cache.find(c => c.name === chName && c.type === ChannelType.GuildText);
      if (!ch) return interaction.reply({ content: `Channel **${chName}** not found.`, ephemeral: true });
      const embed = new EmbedBuilder()
        .setColor(0xF5C518)
        .setTitle('Announcement')
        .setDescription(message)
        .setTimestamp()
        .setFooter({ text: guild.name });
      await ch.send({ embeds: [embed] });
      await interaction.reply({ content: `Announcement posted in #${chName}.`, ephemeral: true });
    }

    // ── /setwelcome ──
    else if (commandName === 'setwelcome') {
      const msg = interaction.options.getString('message');
      welcomeMessages.set(guild.id, msg);
      await interaction.reply({ content: `Welcome message set: "${msg}"`, ephemeral: true });
    }

    // ── /serverinfo ──
    else if (commandName === 'serverinfo') {
      const embed = new EmbedBuilder()
        .setColor(0x4FC3F7)
        .setTitle(guild.name)
        .setThumbnail(guild.iconURL())
        .addFields(
          { name: 'Members',  value: String(guild.memberCount), inline: true },
          { name: 'Channels', value: String(guild.channels.cache.size), inline: true },
          { name: 'Roles',    value: String(guild.roles.cache.size), inline: true },
          { name: 'Created',  value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`, inline: true },
        );
      await interaction.reply({ embeds: [embed] });
    }

    // ── /kick ──
    else if (commandName === 'kick') {
      const user   = interaction.options.getUser('user');
      const reason = interaction.options.getString('reason') || 'No reason provided';
      const member = await guild.members.fetch(user.id);
      await member.kick(reason);
      await interaction.reply({ content: `Kicked **${user.tag}** — ${reason}`, ephemeral: true });
    }

    // ── /ban ──
    else if (commandName === 'ban') {
      const user   = interaction.options.getUser('user');
      const reason = interaction.options.getString('reason') || 'No reason provided';
      await guild.members.ban(user.id, { reason });
      await interaction.reply({ content: `Banned **${user.tag}** — ${reason}`, ephemeral: true });
    }

    // ── /purge ──
    else if (commandName === 'purge') {
      const count = interaction.options.getInteger('count');
      await interaction.deferReply({ ephemeral: true });
      const deleted = await interaction.channel.bulkDelete(count, true);
      await interaction.editReply(`Deleted ${deleted.size} messages.`);
    }

  } catch (err) {
    console.error(`Error in /${commandName}:`, err);
    const reply = { content: `Error: ${err.message}`, ephemeral: true };
    if (interaction.deferred) interaction.editReply(reply);
    else interaction.reply(reply);
  }
});

client.login(TOKEN);
